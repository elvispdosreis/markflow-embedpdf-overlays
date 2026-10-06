import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {HistoryCapability} from '@embedpdf/plugin-history';
import {PdfAnnotationSubtype, type PdfAnnotationObject, type PdfLineAnnoObject,
  type PdfPolylineAnnoObject, type PdfSquareAnnoObject} from '@embedpdf/models';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MeasurementAppearanceController} from './measurement-appearance-controller';
import {distanceDecorationIds} from './distance-measurement';
import {measurementFillDecorationId, measurementFillStylePatch} from './measurement-fill';
import {shapeMeasurementDecorationIds} from './shape-measurement-label';

const line: PdfLineAnnoObject = {
  id: 'distance', pageIndex: 0, type: PdfAnnotationSubtype.LINE,
  rect: {origin: {x: 0, y: 0}, size: {width: 30, height: 40}},
  linePoints: {start: {x: 0, y: 0}, end: {x: 30, y: 40}},
  color: 'transparent', opacity: 1, strokeWidth: 1, strokeColor: '#ef4444', strokeStyle: 1,
  custom: {measurementKind: 'distance', measurementCalibration: {linearFactor: 2, unit: 'm', precision: 2}}
};
const square: PdfSquareAnnoObject = {
  id: 'area', pageIndex: 0, type: PdfAnnotationSubtype.SQUARE,
  rect: {origin: {x: 0, y: 0}, size: {width: 100, height: 60}},
  color: '#5578D7', strokeColor: '#E44234', strokeWidth: 1, opacity: 0.5, strokeStyle: 1, flags: ['print'],
  custom: {measurementKind: 'rectangle-area'}
};

describe('MeasurementAppearanceController', () => {
  let objects: Map<string, PdfAnnotationObject>;
  let controller: MeasurementAppearanceController;
  let api: AnnotationCapability | undefined;
  let documentId: string;
  let purge: ReturnType<typeof vi.fn>;
  let historyScope: ReturnType<typeof vi.fn>;
  let invalid: ReturnType<typeof vi.fn<() => void>>;
  let selected: ReturnType<typeof vi.fn<(kind: 'distance' | 'arc') => void>>;
  let deleted: ReturnType<typeof vi.fn<(id: string) => void>>;
  let imports: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    objects = new Map([[line.id, structuredClone(line)]]);
    documentId = 'a'; purge = vi.fn(); historyScope = vi.fn(() => ({purgeByMetadata: purge}));
    invalid = vi.fn(); selected = vi.fn(); deleted = vi.fn();
    imports = vi.fn((items: {annotation: PdfAnnotationObject}[]) => {
      items.forEach(({annotation}) => objects.set(annotation.id, annotation));
    });
    api = {
      getAnnotations: () => [...objects.values()].map(object => ({object})),
      getAnnotationById: (id: string) => objects.has(id) ? {object: objects.get(id)} : undefined,
      syncAnnotationObject: (id: string, patch: Partial<PdfAnnotationObject>) => {
        objects.set(id, {...objects.get(id)!, ...patch} as PdfAnnotationObject);
      },
      importAnnotations: imports,
      updateAnnotation: (_page: number, id: string, annotation: PdfAnnotationObject) => objects.set(id, annotation),
      deleteAnnotation: (_page: number, id: string) => objects.delete(id),
      transformAnnotation: (_annotation: PdfAnnotationObject, change: {changes: Partial<PdfAnnotationObject>}) => change.changes
    } as unknown as AnnotationCapability;
    controller = new MeasurementAppearanceController({
      getAnnotation: () => api, getHistory: () => ({forDocument: historyScope} as unknown as HistoryCapability),
      getActiveDocumentId: () => documentId, getCalibration: () => ({linearFactor: 1, unit: 'cm', precision: 1}),
      onInvalidArc: invalid, onSelectionRefresh: selected, onDistanceDeleted: deleted
    });
  });

  it('refreshes distance labels using the calibration saved in the annotation', () => {
    controller.refreshDistanceDecorations();
    const ids = distanceDecorationIds(line.id);
    expect(objects.get(ids.label)?.contents).toBe('100,00 m');
    expect(objects.size).toBe(4);
    expect(imports).toHaveBeenCalledTimes(3);
    expect(purge).not.toHaveBeenCalled();
    expect(selected).toHaveBeenCalledWith('distance');
  });

  it('updates existing decorations and purges only their annotation history in the current document', () => {
    controller.syncDistanceAppearance(line, '100,00 m');
    documentId = 'b';
    controller.syncDistanceAppearance(line, '101,00 m');
    expect(objects.size).toBe(4);
    expect(objects.get(distanceDecorationIds(line.id).label)?.contents).toBe('101,00 m');
    expect(historyScope).toHaveBeenCalledWith('b');
    const [predicate, category] = purge.mock.calls[0];
    expect(category).toBe('annotations');
    expect(predicate({annotationIds: [distanceDecorationIds(line.id).startWitness]})).toBe(true);
    expect(predicate({annotationIds: [line.id]})).toBe(false);
    expect(predicate(undefined)).toBe(false);
    controller.deleteDistanceDecorations(line);
    expect(objects.size).toBe(1);
    expect(deleted).toHaveBeenCalledWith(line.id);
  });

  it('removes generated hatching when a shape returns to solid fill and deletes its label', () => {
    objects.set(square.id, square);
    const hatched = {...square, ...measurementFillStylePatch(square, 'fillPattern', 'horizontal')} as PdfSquareAnnoObject;
    controller.syncShapeMeasurementLabel(hatched, '60 m²');
    expect(objects.has(measurementFillDecorationId(square.id))).toBe(true);
    controller.syncShapeMeasurementLabel(square, '60 m²');
    expect(objects.has(measurementFillDecorationId(square.id))).toBe(false);
    expect(objects.has(shapeMeasurementDecorationIds(square.id).label)).toBe(true);
    controller.deleteShapeMeasurementLabel(square);
    expect(objects.has(shapeMeasurementDecorationIds(square.id).label)).toBe(false);
    expect(objects.has(square.id)).toBe(true);
  });

  it('rejects a collinear arc without creating annotations', () => {
    const arc = {...line, type: PdfAnnotationSubtype.POLYLINE,
      vertices: [{x: 0, y: 0}, {x: 1, y: 1}, {x: 2, y: 2}],
      custom: {measurementKind: 'arc'}} as unknown as PdfPolylineAnnoObject;
    expect(controller.normalizeArcAnnotation(arc)).toBeNull();
    controller.syncArcDecorations(arc);
    expect(invalid).toHaveBeenCalledTimes(1);
    expect(imports).not.toHaveBeenCalled();
  });

  it('uses the current annotation capability and safely skips an unavailable viewer', () => {
    api = undefined;
    controller.refreshDistanceDecorations();
    controller.refreshArcAppearances();
    controller.syncShapeMeasurementLabel(square, '60 m²');
    expect(imports).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
  });
});
