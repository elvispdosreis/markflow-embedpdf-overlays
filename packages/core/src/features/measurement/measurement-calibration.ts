import type {PdfAnnotationObject} from '@embedpdf/snippet';
import type {Calibration} from './measurement.models';

export function annotationCalibration(annotation: PdfAnnotationObject, fallback: Calibration): Calibration {
  const value = annotation.custom?.['measurementCalibration'] as Calibration | undefined;
  return value && Number.isFinite(value.linearFactor) && value.linearFactor > 0 ? value : fallback;
}

export function isAreaMeasurement(annotation: PdfAnnotationObject): boolean {
  const kind = annotation.custom?.['measurementKind'];
  return kind === 'area' || kind === 'rectangle-area' || annotation.custom?.['measurementQuantity'] === 'area';
}
