import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PdfAnnotationSubtype, type PdfLineAnnoObject, type PdfPolylineAnnoObject} from '@embedpdf/models';
import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import {MeasurementInteraction, updateDistanceGeometry, type LiveDistancePreview} from './measurement-interaction';
import type {DistanceMeasurementDetails} from './distance-measurement';

describe('MeasurementInteraction', () => {
  let host: HTMLElement, root: ShadowRoot, controller: MeasurementInteraction;
  let frames: Map<number, FrameRequestCallback>, frameId: number;
  let documentId: string, endX: number, endY: number, line: PdfLineAnnoObject | null;
  let arc: PdfPolylineAnnoObject | null, details: DistanceMeasurementDetails;
  let preview: ReturnType<typeof vi.fn<(preview: LiveDistancePreview | null) => void>>;
  let settled: ReturnType<typeof vi.fn<(documentId: string, annotationId: string) => void>>;
  let sync: ReturnType<typeof vi.fn>;
  let annotation: AnnotationCapability;

  beforeEach(() => {
    vi.useFakeTimers(); frames = new Map(); frameId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {frames.set(++frameId, callback); return frameId;});
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    host = document.createElement('div'); document.body.append(host); root = host.attachShadow({mode: 'open'});
    documentId = 'doc'; endX = 100; endY = 0; arc = null;
    line = {id: 'line', pageIndex: 0, type: PdfAnnotationSubtype.LINE,
      linePoints: {start: {x: 0, y: 0}, end: {x: 100, y: 0}}, custom: {
        measurementCalibration: {linearFactor: 0.1, unit: 'm', precision: 2}
      }} as PdfLineAnnoObject;
    details = {annotationId: 'line', pageIndex: 0, strokeColor: '#ff0000', strokeWidth: 2} as DistanceMeasurementDetails;
    for (const index of [1, 0]) {
      const handle = document.createElement('div'); handle.dataset['epdfVertex'] = String(index);
      vi.spyOn(handle, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
      vi.spyOn(handle, 'getBoundingClientRect').mockImplementation(() => ({left: 20 + (index ? endX : 0),
        top: 30 + (index ? endY : 0), width: 0, height: 0}) as DOMRect);
      root.append(handle);
    }
    preview = vi.fn(); settled = vi.fn(); sync = vi.fn();
    annotation = {forDocument: vi.fn(() => ({getAnnotationById: (id: string) => ({object: id === 'line' ? line : {id}}),
      syncAnnotationObject: sync}))} as unknown as AnnotationCapability;
    controller = new MeasurementInteraction({root, annotation, getActiveDocumentId: () => documentId,
      getHostBounds: () => ({left: 10, top: 15}), getCalibration: () => ({linearFactor: 1, unit: 'cm', precision: 0}),
      getSelectedLine: () => line, getSelectedArc: () => arc, getDistanceDetails: () => details,
      onPreview: preview, onDistanceDetails: value => {details = value;}, onDistanceSettled: settled});
  });

  afterEach(() => {controller.destroy(); host.remove(); vi.unstubAllGlobals(); vi.useRealTimers();});
  function down(button = 0) {
    root.querySelector('[data-epdf-vertex="0"]')!.dispatchEvent(new MouseEvent('pointerdown', {button, bubbles: true, composed: true}));
  }
  function flush() {const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0));}

  it('uses sorted native handles, host offsets and annotation-specific calibration for live distance', () => {
    down(); expect(controller.isDragging).toBe(true);
    endX = 120; endY = 50; window.dispatchEvent(new Event('pointermove')); flush();
    expect(details.distanceValue).toBe(13);
    expect(details.formattedDistance).toBe('13,00 m');
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({start: {x: 10, y: 15},
      end: {x: 130, y: 65}, middle: {x: 70, y: 40}, strokeColor: '#ff0000', strokeWidth: 2}));
    expect(sync).toHaveBeenCalledWith(expect.any(String), {opacity: 0});
  });

  it('coalesces motion into one frame and settles only after the native transform delay', () => {
    down(); window.dispatchEvent(new Event('pointermove')); window.dispatchEvent(new Event('pointermove'));
    expect(frames.size).toBe(1); flush();
    window.dispatchEvent(new Event('pointerup'));
    expect(controller.isDragging).toBe(false); expect(settled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(79); expect(settled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(settled).toHaveBeenCalledWith('doc', 'line');
    expect(preview).toHaveBeenLastCalledWith(null);
    expect(sync).toHaveBeenLastCalledWith(expect.any(String), {opacity: 1});
  });

  it('restores decoration visibility and cancels pending work when unmounted', () => {
    down(); controller.destroy(); flush(); vi.runAllTimers();
    expect(frames.size).toBe(0); expect(settled).not.toHaveBeenCalled();
    expect(sync).toHaveBeenLastCalledWith(expect.any(String), {opacity: 1});
    sync.mockClear(); down(); window.dispatchEvent(new Event('pointerup'));
    expect(sync).not.toHaveBeenCalled();
  });

  it('clears the delayed settlement on cancel and does not notify after destroy', () => {
    down(); window.dispatchEvent(new Event('pointerup')); controller.cancel();
    vi.runAllTimers(); expect(settled).not.toHaveBeenCalled();
    down(); window.dispatchEvent(new Event('pointerup')); controller.destroy();
    vi.runAllTimers(); expect(settled).not.toHaveBeenCalled();
  });

  it('cancels when the active document changes and does not settle into another document', () => {
    down(); documentId = 'other'; window.dispatchEvent(new Event('pointermove')); flush();
    expect(controller.isDragging).toBe(false); expect(preview).toHaveBeenLastCalledWith(null);
    expect(settled).not.toHaveBeenCalled();
    documentId = 'doc'; down(); window.dispatchEvent(new Event('pointerup')); documentId = 'other';
    vi.runAllTimers(); expect(settled).not.toHaveBeenCalled();
  });

  it('ignores secondary clicks, missing selections and coincident handles', () => {
    down(2); expect(controller.isDragging).toBe(false);
    endX = 0; down(); expect(controller.isDragging).toBe(false);
    line = null; endX = 100; down(); expect(controller.isDragging).toBe(false);
  });

  it('shows only arc control vertices and restores all handles on deselection or destroy', () => {
    for (const index of [2, 3, 4]) {const handle = document.createElement('div'); handle.dataset['epdfVertex'] = String(index); root.append(handle);}
    arc = {vertices: Array.from({length: 5}, (_, x) => ({x, y: 0})), custom: {arcThroughVertexIndex: 3}} as PdfPolylineAnnoObject;
    controller.scheduleArcHandles(); controller.scheduleArcHandles(); expect(frames.size).toBe(1); flush();
    expect(root.querySelector<HTMLElement>('[data-epdf-vertex="2"]')!.style.pointerEvents).toBe('none');
    expect(root.querySelector<HTMLElement>('[data-epdf-vertex="3"]')!.style.visibility).toBe('');
    arc = null; controller.scheduleArcHandles(); flush();
    expect(root.querySelector<HTMLElement>('[data-epdf-vertex="2"]')!.style.visibility).toBe('');
  });

  it('edits distance and angle through the native transform API and respects invalid scale', () => {
    const patch = {changed: true}, transformAnnotation = vi.fn(() => patch), updateAnnotation = vi.fn();
    const api = {transformAnnotation, updateAnnotation} as unknown as AnnotationCapability;
    updateDistanceGeometry(api, line!, 5, 90, {linearFactor: 0.1, unit: 'm', precision: 2});
    expect(transformAnnotation).toHaveBeenCalledWith(line, {type: 'vertex-edit', changes: {
      linePoints: {start: {x: 0, y: 0}, end: {x: expect.closeTo(0, 5), y: expect.closeTo(50, 5)}}
    }});
    expect(updateAnnotation).toHaveBeenCalledWith(0, 'line', patch);
    updateDistanceGeometry(api, line!, 5, 90, {linearFactor: 0, unit: 'm', precision: 2});
    expect(transformAnnotation).toHaveBeenCalledOnce();
  });
});
