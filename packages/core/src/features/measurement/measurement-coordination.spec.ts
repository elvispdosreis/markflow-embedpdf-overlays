import type {AnnotationCapability, AnnotationEvent} from '@embedpdf/plugin-annotation';
import {PdfAnnotationSubtype, type PdfAnnotationObject, type PdfLineAnnoObject} from '@embedpdf/models';
import {describe, expect, it, vi} from 'vitest';
import {MeasurementEventsController} from './measurement-events-controller';
import {MeasurementSelectionController} from './measurement-selection-controller';
import {MeasurementState} from './measurement-state';
import {buildDistanceDecorations} from './distance-measurement';
import type {MeasurementRecord} from './measurement.models';

const line: PdfLineAnnoObject = {
  id: 'line', pageIndex: 0, type: PdfAnnotationSubtype.LINE,
  rect: {origin: {x: 0, y: 0}, size: {width: 30, height: 40}},
  linePoints: {start: {x: 0, y: 0}, end: {x: 30, y: 40}},
  color: 'transparent', opacity: 1, strokeWidth: 1, strokeColor: '#ef4444', strokeStyle: 1,
  custom: {measurementKind: 'distance', measurementCalibration: {linearFactor: 2, unit: 'm', precision: 2}}
};
const record: MeasurementRecord = {annotationId: 'line', pageIndex: 0, kind: 'distance', rawValue: 100, formattedValue: '100 m'};
function event(type: 'create' | 'delete' | 'update', annotation: PdfAnnotationObject, patch = {}): AnnotationEvent {
  return {type, annotation, patch, documentId: 'a', pageIndex: 0, committed: true} as AnnotationEvent;
}
function events() {
  const state = new MeasurementState(() => {});
  const history = {recordCreation: vi.fn()};
  const appearance = {
    deleteDistanceDecorations: vi.fn(), deleteArcDecorations: vi.fn(),
    deleteShapeMeasurementLabel: vi.fn(), deletePerimeterMeasurementLabel: vi.fn(),
    normalizeArcAnnotation: vi.fn(annotation => annotation), syncArcDecorations: vi.fn(),
    syncDistanceAppearance: vi.fn(), syncShapeMeasurementLabel: vi.fn(), syncPerimeterMeasurementLabel: vi.fn()
  };
  const measure = vi.fn((_annotation: PdfAnnotationObject): MeasurementRecord | null => record);
  const deleted = vi.fn(), refresh = vi.fn();
  const controller = new MeasurementEventsController({
    state, history, appearance, measure, getActiveDocumentId: () => 'a',
    onDeleted: deleted, onSelectionRefresh: refresh
  });
  return {controller, state, history, appearance, measure, deleted, refresh};
}

describe('MeasurementEventsController', () => {
  it('merges update patches and records only creation in the measurement history', () => {
    const setup = events();
    setup.controller.handle(event('create', line));
    setup.controller.handle(event('update', line, {strokeColor: '#000000'}));
    expect(setup.history.recordCreation).toHaveBeenCalledTimes(1);
    expect(setup.history.recordCreation).toHaveBeenCalledWith('a', line);
    expect(setup.measure).toHaveBeenLastCalledWith(expect.objectContaining({strokeColor: '#000000'}));
    expect(setup.appearance.syncDistanceAppearance).toHaveBeenCalledTimes(2);
    expect(setup.state.get('a')).toEqual([record]);
    setup.controller.handle(event('delete', line));
    expect(setup.state.get('a')).toEqual([]);
    expect(setup.appearance.deleteDistanceDecorations).toHaveBeenCalledWith(line);
    expect(setup.deleted).toHaveBeenCalledWith('line');
  });

  it('ignores generated decorations to prevent recursive measurement events', () => {
    const setup = events();
    for (const decoration of buildDistanceDecorations(line, '100 m')) {
      setup.controller.handle(event('create', decoration));
      setup.controller.handle(event('update', decoration, {contents: '100 m'}));
    }
    expect(setup.measure).not.toHaveBeenCalled();
    expect(setup.history.recordCreation).not.toHaveBeenCalled();
    expect(setup.refresh).not.toHaveBeenCalled();
  });

  it('marks committed arc vertex edits for normalization and stops on invalid geometry', () => {
    const setup = events();
    const arc = {...line, type: PdfAnnotationSubtype.POLYLINE,
      custom: {measurementKind: 'arc', arcGenerated: true},
      vertices: [{x: 0, y: 0}, {x: 2, y: 0}, {x: 1, y: 1}]} as unknown as PdfAnnotationObject;
    setup.controller.handle(event('update', arc, {vertices: [{x: 0, y: 0}, {x: 3, y: 0}, {x: 1, y: 1}]}));
    expect(setup.appearance.normalizeArcAnnotation).toHaveBeenCalledWith(expect.objectContaining({
      custom: expect.objectContaining({arcGenerated: false})
    }));
    setup.appearance.normalizeArcAnnotation.mockReturnValueOnce(null);
    setup.measure.mockClear();
    setup.controller.handle(event('create', arc));
    expect(setup.measure).not.toHaveBeenCalled();
    expect(setup.history.recordCreation).not.toHaveBeenCalled();
  });
});

function selection(annotation: PdfAnnotationObject = line) {
  let current = annotation;
  let dragging = false;
  const update = vi.fn(), remove = vi.fn(), distance = vi.fn(), arc = vi.fn();
  const clear = vi.fn(), status = vi.fn(), sidebar = vi.fn();
  const scope = {getAnnotationById: () => ({object: current}), updateAnnotation: update, deleteAnnotation: remove};
  const api = {
    forDocument: vi.fn(() => scope),
    getSelectedAnnotations: () => [{object: current}],
    transformAnnotation: (_annotation: PdfAnnotationObject, change: {changes: Partial<PdfAnnotationObject>}) => change.changes
  } as unknown as AnnotationCapability;
  const controller = new MeasurementSelectionController({
    getAnnotation: () => api, getActiveDocumentId: () => 'a',
    getCalibration: () => ({linearFactor: 1, unit: 'cm', precision: 1}),
    isDragging: () => dragging, onDistance: distance, onArc: arc, onArcHandles: vi.fn(),
    onDetailClear: clear, onStatus: status, onSidebarChange: sidebar
  });
  return {controller, api, update, remove, distance, arc, clear, status, sidebar,
    setAnnotation: (value: PdfAnnotationObject) => {current = value;},
    setDragging: (value: boolean) => {dragging = value;}};
}

describe('MeasurementSelectionController', () => {
  it('uses saved calibration for selection and preserves live distance details while dragging', () => {
    const setup = selection();
    setup.controller.refreshSelectedDistance();
    expect(setup.distance).toHaveBeenCalledWith(expect.objectContaining({formattedDistance: '100,00 m'}));
    setup.distance.mockClear();
    setup.setDragging(true);
    setup.controller.refreshSelectedDistance();
    expect(setup.distance).not.toHaveBeenCalled();
    expect(setup.arc).toHaveBeenCalledWith(null);
  });

  it('rejects edits from another document and preserves the minimum area vertices', () => {
    const area = {...line, type: PdfAnnotationSubtype.POLYGON,
      custom: {measurementKind: 'area'}, vertices: [{x: 0, y: 0}, {x: 4, y: 0}, {x: 0, y: 4}]
    } as unknown as PdfAnnotationObject;
    const setup = selection(area);
    setup.controller.deleteAreaVertex('b', 'line', 0);
    expect(setup.api.forDocument).not.toHaveBeenCalled();
    setup.controller.deleteAreaVertex('a', 'line', 0);
    expect(setup.update).not.toHaveBeenCalled();
    expect(setup.status).toHaveBeenCalledWith('A área precisa de pelo menos três vértices.');
    setup.setAnnotation({...area, vertices: [{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 4}, {x: 0, y: 4}]} as PdfAnnotationObject);
    setup.controller.deleteAreaVertex('a', 'line', 1);
    expect(setup.update).toHaveBeenCalledWith(0, 'line', {vertices: [{x: 0, y: 0}, {x: 4, y: 4}, {x: 0, y: 4}]});
    expect(setup.clear).toHaveBeenCalledTimes(1);
    expect(setup.sidebar).toHaveBeenCalledTimes(1);
  });

  it('deletes the measurement when its final perimeter segment is removed', () => {
    const perimeter = {...line, type: PdfAnnotationSubtype.POLYLINE, custom: {measurementKind: 'perimeter'},
      vertices: [{x: 0, y: 0}, {x: 4, y: 0}]} as unknown as PdfAnnotationObject;
    const setup = selection(perimeter);
    setup.controller.deletePerimeterSegment('a', 'line', 9);
    expect(setup.remove).not.toHaveBeenCalled();
    setup.controller.deletePerimeterSegment('a', 'line', 0);
    expect(setup.remove).toHaveBeenCalledWith(0, 'line');
    expect(setup.update).not.toHaveBeenCalled();
    expect(setup.clear).toHaveBeenCalledTimes(1);
  });
});
