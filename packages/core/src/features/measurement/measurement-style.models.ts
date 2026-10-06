import type {MeasurementKind} from './measurement.models';
import {PdfAnnotationBorderStyle} from '@embedpdf/snippet';

export type MeasurementStyleProperty =
  | 'color'
  | 'fillPattern'
  | 'opacity'
  | 'strokeColor'
  | 'strokeStyle'
  | 'strokeWidth'
  | 'lineEndings'
  | 'rotation';

const LINE_PROPERTIES: readonly MeasurementStyleProperty[] = [
  'strokeColor', 'opacity', 'strokeStyle', 'strokeWidth', 'lineEndings'
];

export function measurementStyleProperties(kind: MeasurementKind): readonly MeasurementStyleProperty[] {
  if (kind === 'distance' || kind === 'perimeter' || kind === 'arc') return LINE_PROPERTIES;
  if (kind === 'area') return ['color', 'fillPattern', 'strokeColor', 'opacity', 'strokeWidth'];
  return ['color', 'fillPattern', 'strokeColor', 'opacity', 'strokeWidth', 'rotation'];
}

export function measurementStrokeStylePatch(value: unknown) {
  const dashed = value === PdfAnnotationBorderStyle.DASHED;
  return {strokeStyle: dashed ? PdfAnnotationBorderStyle.DASHED : PdfAnnotationBorderStyle.SOLID,
    strokeDashArray: dashed ? [4, 3] : []};
}
