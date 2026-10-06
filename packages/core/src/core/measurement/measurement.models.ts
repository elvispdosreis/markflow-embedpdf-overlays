export type MeasurementKind = 'distance' | 'perimeter' | 'area' | 'rectangle-area' | 'ellipse' | 'arc';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  width: number;
  height: number;
}

export type MeasurementUnit = 'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft' | 'yd' | 'mi' | 'pt';

export interface Calibration {
  linearFactor: number;
  unit: MeasurementUnit;
  precision: number;
}

export interface MeasurementRecord {
  annotationId: string;
  pageIndex: number;
  kind: MeasurementKind;
  rawValue: number;
  formattedValue: string;
  quantity?: 'length' | 'area';
}
