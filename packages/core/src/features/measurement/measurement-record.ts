import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/models';
import {annotationCalibration, isAreaMeasurement} from './measurement-calibration';
import {arcGeometryFromAnnotation} from './arc-measurement';
import {isDistanceDecoration} from './distance-measurement';
import {measurementKindFromAnnotation} from './measurement-tools';
import {MeasurementCalculator} from './measurement-calculator';
import type {Calibration, MeasurementRecord} from './measurement.models';

/** Resolve all measurement kinds using annotation-specific calibration when present. */
export function measurementRecord(annotation: PdfAnnotationObject, fallback: Calibration,
  calculator: MeasurementCalculator): MeasurementRecord | null {
  if (isDistanceDecoration(annotation)) {
    return null;
  }

  const kind = measurementKindFromAnnotation(annotation);
  if (!kind) {
    return null;
  }

  const calibration = annotationCalibration(annotation, fallback);
  let rawValue: number;
  let squared = false;

  switch (kind) {
    case 'distance':
      if (annotation.type !== PdfAnnotationSubtype.LINE) {
        return null;
      }
      rawValue = calculator.distance(annotation.linePoints.start, annotation.linePoints.end, calibration);
      break;
    case 'perimeter':
      if (annotation.type !== PdfAnnotationSubtype.POLYLINE) {
        return null;
      }
      rawValue = calculator.perimeter(annotation.vertices, calibration);
      break;
    case 'area':
      if (annotation.type !== PdfAnnotationSubtype.POLYGON) {
        return null;
      }
      rawValue = calculator.polygonArea(annotation.vertices, calibration);
      squared = true;
      break;
    case 'rectangle-area':
      if (annotation.type !== PdfAnnotationSubtype.SQUARE) {
        return null;
      }
      rawValue = calculator.rectangleArea(annotation.rect.size, calibration);
      squared = true;
      break;
    case 'ellipse':
      if (annotation.type !== PdfAnnotationSubtype.CIRCLE) {
        return null;
      }
      squared = isAreaMeasurement(annotation);
      rawValue = squared
        ? calculator.ellipseArea(annotation.rect.size, calibration)
        : calculator.ellipsePerimeter(annotation.rect.size, calibration);
      break;
    case 'arc': {
      if (annotation.type !== PdfAnnotationSubtype.POLYLINE) {
        return null;
      }
      const geometry = arcGeometryFromAnnotation(annotation);
      if (!geometry) {
        return null;
      }
      rawValue = calculator.arcLength(geometry.radius, geometry.sweepRadians, calibration);
      break;
    }
    default:
      return null;
  }

  return {
    annotationId: annotation.id,
    pageIndex: annotation.pageIndex,
    kind,
    rawValue,
    quantity: squared ? 'area' : 'length',
    formattedValue: calculator.format(rawValue, calibration, squared)
  };
}

