import {
  PdfAnnotationSubtype,
  type PdfCircleAnnoObject,
  type PdfPolygonAnnoObject,
  type PdfSquareAnnoObject
} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {
  buildShapeMeasurementLabel,
  isShapeMeasurementAnnotation,
  shapeMeasurementNeedsLabel,
  shapeMeasurementPatch
} from './shape-measurement-label';

const rectangle = {
  id: 'rectangle-1',
  pageIndex: 0,
  type: PdfAnnotationSubtype.SQUARE,
  rect: {origin: {x: 20, y: 30}, size: {width: 100, height: 60}},
  color: 'transparent',
  opacity: 1,
  strokeWidth: 1,
  strokeColor: '#ef4444',
  custom: {measurementKind: 'rectangle-area'}
} as PdfSquareAnnoObject;

describe('shape measurement labels', () => {
  it('centraliza o valor dentro da área retangular e da elipse', () => {
    const ellipse = {
      ...rectangle,
      id: 'ellipse-1',
      type: PdfAnnotationSubtype.CIRCLE,
      custom: {measurementKind: 'ellipse'}
    } as PdfCircleAnnoObject;

    for (const annotation of [rectangle, ellipse]) {
      const label = buildShapeMeasurementLabel(annotation, '12,50 m²');
      expect(label.rect.origin.x + label.rect.size.width / 2).toBe(70);
      expect(label.rect.origin.y + label.rect.size.height / 2).toBe(60);
      expect(label.contents).toBe('12,50 m²');
      expect(label.fontSize).toBe(10);
      expect(label.fontColor).toBe('#ef4444');
      expect(label.strokeColor).toBe(label.fontColor);
      expect(label.strokeWidth).toBe(0);
      expect(label.color).toBe('transparent');
      expect(label.flags).toEqual(['print', 'readOnly', 'locked']);
      expect(label.custom).toEqual({measurementDecorationFor: annotation.id});
    }
  });

  it('posiciona o valor da área no centroide do polígono', () => {
    const polygon = {
      ...rectangle,
      id: 'area-1',
      type: PdfAnnotationSubtype.POLYGON,
      rect: {origin: {x: 0, y: 0}, size: {width: 100, height: 100}},
      vertices: [{x: 0, y: 0}, {x: 100, y: 0}, {x: 0, y: 100}],
      custom: {measurementKind: 'area'}
    } as PdfPolygonAnnoObject;
    const label = buildShapeMeasurementLabel(polygon, '5,00 m²');

    expect(label.rect.origin.x + label.rect.size.width / 2).toBeCloseTo(100 / 3, 6);
    expect(label.rect.origin.y + label.rect.size.height / 2).toBeCloseTo(100 / 3, 6);
  });

  it('vincula o identificador do rótulo à medição sem perder seus metadados', () => {
    expect(isShapeMeasurementAnnotation(rectangle)).toBe(true);
    expect(shapeMeasurementNeedsLabel(rectangle, '12,50 m²')).toBe(true);

    const patch = shapeMeasurementPatch(rectangle, '12,50 m²');
    const updated = {...rectangle, ...patch} as PdfSquareAnnoObject;
    expect(updated.contents).toBe('12,50 m²');
    expect(updated.custom).toMatchObject({
      measurementKind: 'rectangle-area',
      measurementDecorationIds: {label: 'rectangle-1-shape-measurement-label'}
    });
    expect(shapeMeasurementNeedsLabel(updated, '12,50 m²')).toBe(false);
  });
});
