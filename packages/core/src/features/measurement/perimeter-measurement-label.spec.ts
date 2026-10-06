import {PdfAnnotationBorderStyle, PdfAnnotationSubtype, type PdfPolylineAnnoObject} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {
  buildPerimeterMeasurementLabel,
  isPerimeterMeasurementAnnotation,
  perimeterMeasurementLabelIds,
  perimeterMeasurementNeedsLabel,
  perimeterMeasurementPatch
} from './perimeter-measurement-label';

const perimeter: PdfPolylineAnnoObject = {
  id: 'perimeter-1',
  pageIndex: 0,
  type: PdfAnnotationSubtype.POLYLINE,
  rect: {origin: {x: 10, y: 10}, size: {width: 100, height: 80}},
  vertices: [{x: 10, y: 10}, {x: 60, y: 10}, {x: 60, y: 90}],
  color: 'transparent',
  opacity: 1,
  strokeWidth: 1,
  strokeColor: '#ef4444',
  strokeStyle: PdfAnnotationBorderStyle.SOLID,
  custom: {measurementKind: 'perimeter'}
};

describe('perimeter measurement label', () => {
  it('posiciona o texto no ponto médio do caminho medido', () => {
    const label = buildPerimeterMeasurementLabel(perimeter, '13,00 m');
    const center = {
      x: label.rect.origin.x + label.rect.size.width / 2,
      y: label.rect.origin.y + label.rect.size.height / 2
    };

    expect(center).toEqual({x: 60, y: 25});
    expect(label.contents).toBe('13,00 m');
    expect(label.fontSize).toBe(10);
    expect(label.fontColor).toBe('#ef4444');
    expect(label.strokeColor).toBe(label.fontColor);
    expect(label.strokeWidth).toBe(0);
    expect(label.color).toBe('transparent');
    expect(label.flags).toEqual(['print', 'readOnly', 'locked']);
    expect(label.custom).toEqual({measurementDecorationFor: perimeter.id});
  });

  it('vincula o rótulo e o valor à anotação de perímetro', () => {
    expect(isPerimeterMeasurementAnnotation(perimeter)).toBe(true);
    expect(perimeterMeasurementLabelIds(perimeter.id).label).toBe('perimeter-1-perimeter-measurement-label');

    const patch = perimeterMeasurementPatch(perimeter, '13,00 m');
    expect(patch).toMatchObject({
      contents: '13,00 m',
      subject: 'Medição de perímetro',
      custom: {
        measurementKind: 'perimeter',
        measurementDecorationIds: {label: 'perimeter-1-perimeter-measurement-label'}
      }
    });
    expect(perimeterMeasurementNeedsLabel(perimeter, '13,00 m')).toBe(true);
    expect(perimeterMeasurementNeedsLabel({...perimeter, ...patch}, '13,00 m')).toBe(false);
  });
});
