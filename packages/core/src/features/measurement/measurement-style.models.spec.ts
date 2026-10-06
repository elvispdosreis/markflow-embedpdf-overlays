import {describe, expect, it} from 'vitest';
import {measurementStyleProperties, measurementStrokeStylePatch} from './measurement-style.models';
import {PdfAnnotationBorderStyle} from '@embedpdf/snippet';

describe('measurement style properties', () => {
  it('offers native line controls for distance, perimeter and arc', () => {
    for (const kind of ['distance', 'perimeter', 'arc'] as const) {
      expect(measurementStyleProperties(kind)).toEqual([
        'strokeColor', 'opacity', 'strokeStyle', 'strokeWidth', 'lineEndings'
      ]);
    }
  });

  it('offers native polygon controls for area', () => {
    expect(measurementStyleProperties('area')).toEqual([
      'color', 'fillPattern', 'strokeColor', 'opacity', 'strokeWidth'
    ]);
  });

  it('offers native shape controls for rectangle and ellipse', () => {
    for (const kind of ['rectangle-area', 'ellipse'] as const) {
      expect(measurementStyleProperties(kind)).toEqual([
        'color', 'fillPattern', 'strokeColor', 'opacity', 'strokeWidth', 'rotation'
      ]);
    }
  });

  it('supplies a visible dash pattern and clears it when returning to solid', () => {
    expect(measurementStrokeStylePatch(PdfAnnotationBorderStyle.DASHED)).toEqual({
      strokeStyle: PdfAnnotationBorderStyle.DASHED, strokeDashArray: [4, 3]
    });
    expect(measurementStrokeStylePatch(PdfAnnotationBorderStyle.SOLID)).toEqual({
      strokeStyle: PdfAnnotationBorderStyle.SOLID, strokeDashArray: []
    });
  });
});
