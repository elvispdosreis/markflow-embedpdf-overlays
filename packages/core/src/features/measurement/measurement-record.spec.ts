import {describe, expect, it} from 'vitest';
import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/models';
import {MeasurementCalculator} from './measurement-calculator';
import {measurementRecord} from './measurement-record';

const calculator = new MeasurementCalculator();
const fallback = {linearFactor: 1, unit: 'm' as const, precision: 2};

describe('measurementRecord', () => {
  it('uses stored calibration instead of the host fallback when deriving a distance record', () => {
    const annotation = {id: 'line', pageIndex: 2, type: PdfAnnotationSubtype.LINE,
      custom: {measurementKind: 'distance', measurementCalibration: {linearFactor: 0.2, unit: 'cm', precision: 1}},
      linePoints: {start: {x: 0, y: 0}, end: {x: 3, y: 4}}} as PdfAnnotationObject;
    expect(measurementRecord(annotation, fallback, calculator)).toMatchObject({
      annotationId: 'line', pageIndex: 2, rawValue: 1, kind: 'distance', quantity: 'length', formattedValue: '1,0 cm'
    });
  });

  it('distinguishes ellipse perimeter from area and applies the appropriate scale power', () => {
    const annotation = {id: 'ellipse', pageIndex: 0, type: PdfAnnotationSubtype.CIRCLE,
      rect: {origin: {x: 0, y: 0}, size: {width: 20, height: 10}}, custom: {measurementKind: 'ellipse'}} as PdfAnnotationObject;
    const length = measurementRecord(annotation, fallback, calculator)!;
    const doubledLength = measurementRecord(annotation, {...fallback, linearFactor: 2}, calculator)!;
    expect(length.quantity).toBe('length'); expect(doubledLength.rawValue).toBeCloseTo(length.rawValue * 2);
    const areaAnnotation = {...annotation, custom: {...annotation.custom, measurementQuantity: 'area'}};
    const area = measurementRecord(areaAnnotation, fallback, calculator)!;
    const doubledArea = measurementRecord(areaAnnotation, {...fallback, linearFactor: 2}, calculator)!;
    expect(area.quantity).toBe('area'); expect(doubledArea.rawValue).toBeCloseTo(area.rawValue * 4);
  });

  it('ignores unrelated annotations and inconsistent measurement geometry', () => {
    const annotation = {id: 'text', pageIndex: 0, type: PdfAnnotationSubtype.TEXT} as PdfAnnotationObject;
    expect(measurementRecord(annotation, fallback, calculator)).toBeNull();
    expect(measurementRecord({...annotation, custom: {measurementKind: 'distance'}}, fallback, calculator)).toBeNull();
  });
});
