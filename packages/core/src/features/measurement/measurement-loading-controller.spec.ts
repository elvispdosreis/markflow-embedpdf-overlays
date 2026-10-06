import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/models';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {MeasurementLoadingController} from './measurement-loading-controller';
import {MeasurementState} from './measurement-state';
import type {MeasurementRecord} from './measurement.models';

describe('MeasurementLoadingController', () => {
  afterEach(() => vi.useRealTimers());
  function setup() {
    let id = 'a';
    const state = new MeasurementState(() => {});
    const annotation = {id: 'distance', pageIndex: 0, type: PdfAnnotationSubtype.LINE,
      custom: {measurementKind: 'distance'}} as PdfAnnotationObject;
    const record: MeasurementRecord = {annotationId: 'distance', pageIndex: 0, kind: 'distance', rawValue: 20, formattedValue: '20 m'};
    const markLoaded = vi.fn(), refresh = vi.fn(), sync = vi.fn();
    const controller = new MeasurementLoadingController({
      getAnnotation: () => ({getAnnotations: () => [{object: annotation}]} as unknown as AnnotationCapability),
      getActiveDocumentId: () => id, state, history: {markLoaded},
      measure: () => record, onSelectionRefresh: refresh,
      appearance: {normalizeArcAnnotation: value => value, syncArcDecorations: vi.fn(),
        syncDistanceAppearance: sync, syncShapeMeasurementLabel: vi.fn(), syncPerimeterMeasurementLabel: vi.fn(),
        deleteArcDecorations: vi.fn(), deleteDistanceDecorations: vi.fn(),
        deleteShapeMeasurementLabel: vi.fn(), deletePerimeterMeasurementLabel: vi.fn()}
    });
    return {controller, state, annotation, record, markLoaded, sync, refresh, setId: (value: string) => {id = value;}};
  }
  it('rebuilds loaded results and merges imported results without duplicates or changing another document', () => {
    const s = setup();
    s.state.replace('b', [{...s.record, annotationId: 'other'}]);
    s.controller.refreshLoadedMeasurements();
    expect(s.state.get('a')).toEqual([s.record]);
    expect(s.markLoaded).toHaveBeenCalledWith('a', ['distance']);
    s.controller.refreshImportedAnnotations([s.annotation]);
    expect(s.state.get('a')).toEqual([s.record]);
    expect(s.state.get('b')[0].annotationId).toBe('other');
    expect(s.sync).toHaveBeenCalledTimes(2);
  });
  it('drops deferred refreshes after a document switch or destruction', () => {
    vi.useFakeTimers();
    const s = setup(), action = vi.fn();
    s.controller.defer(action); s.setId('b'); vi.runAllTimers();
    expect(action).not.toHaveBeenCalled();
    s.controller.defer(action); s.controller.destroy(); vi.runAllTimers();
    expect(action).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
