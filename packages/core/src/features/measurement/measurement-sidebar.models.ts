import {
  PdfAnnotationSubtype,
  type PdfAnnotationObject,
  type PdfLineAnnoObject,
  type PdfPolygonAnnoObject,
  type PdfPolylineAnnoObject
} from '@embedpdf/snippet';
import {arcGeometryFromAnnotation} from './arc-measurement';
import {annotationCalibration, isAreaMeasurement} from './measurement-calibration';
import {MeasurementCalculator} from './measurement-calculator';
import {measurementKindFromAnnotation} from './measurement-tools';
import type {Calibration, MeasurementKind} from './measurement.models';

export interface MeasurementSidebarDetailRow {
  labelKey: string;
  value: string;
  highlight?: {kind: 'segment' | 'vertex'; index: number};
}

export interface MeasurementSidebarItem {
  id: string;
  pageIndex: number;
  kind: MeasurementKind;
  formattedValue: string;
  detailRows: MeasurementSidebarDetailRow[];
  strokeColor: string;
  strokeWidth: number;
  calibration: Calibration;
  rect: PdfAnnotationObject['rect'];
}

const keys = {
  angle: 'markflow.measurements.sidebar.angle',
  axisX: 'markflow.measurements.sidebar.axisX',
  axisY: 'markflow.measurements.sidebar.axisY',
  segments: 'markflow.measurements.sidebar.segments',
  segment: 'markflow.measurements.sidebar.segment',
  vertices: 'markflow.measurements.sidebar.vertices',
  vertex: 'markflow.measurements.sidebar.vertex',
  perimeter: 'markflow.measurements.sidebar.perimeterValue',
  area: 'markflow.measurements.sidebar.areaValue',
  width: 'markflow.measurements.sidebar.width',
  height: 'markflow.measurements.sidebar.height',
  horizontalAxis: 'markflow.measurements.sidebar.horizontalAxis',
  verticalAxis: 'markflow.measurements.sidebar.verticalAxis',
  radius: 'markflow.measurements.sidebar.radius',
  centralAngle: 'markflow.measurements.sidebar.centralAngle',
  chord: 'markflow.measurements.sidebar.chord'
} as const;

export function measurementSidebarItems(
  annotations: PdfAnnotationObject[],
  fallbackCalibration: Calibration
): MeasurementSidebarItem[] {
  const calculator = new MeasurementCalculator();
  return annotations
    .map(annotation => safeProjectMeasurement(annotation, fallbackCalibration, calculator))
    .filter((item): item is MeasurementSidebarItem => item !== null)
    .sort((left, right) => left.pageIndex - right.pageIndex
      || left.rect.origin.y - right.rect.origin.y
      || left.rect.origin.x - right.rect.origin.x);
}

function safeProjectMeasurement(
  annotation: PdfAnnotationObject,
  fallbackCalibration: Calibration,
  calculator: MeasurementCalculator
): MeasurementSidebarItem | null {
  try {
    if (!Number.isFinite(annotation.rect?.origin?.x)
      || !Number.isFinite(annotation.rect?.origin?.y)
      || !Number.isFinite(annotation.rect?.size?.width)
      || !Number.isFinite(annotation.rect?.size?.height)) return null;
    return projectMeasurement(annotation, fallbackCalibration, calculator);
  } catch {
    return null;
  }
}

function projectMeasurement(
  annotation: PdfAnnotationObject,
  fallbackCalibration: Calibration,
  calculator: MeasurementCalculator
): MeasurementSidebarItem | null {
  const kind = measurementKindFromAnnotation(annotation);
  if (!kind) return null;
  const calibration = annotationCalibration(annotation, fallbackCalibration);
  const linear = (value: number) => calculator.format(value, calibration);
  const area = (value: number) => calculator.format(value, calibration, true);
  let formattedValue: string;
  let detailRows: MeasurementSidebarDetailRow[];

  switch (kind) {
    case 'distance': {
      if (annotation.type !== PdfAnnotationSubtype.LINE) return null;
      const line = annotation as PdfLineAnnoObject;
      const deltaX = (line.linePoints.end.x - line.linePoints.start.x) * calibration.linearFactor;
      const deltaY = (line.linePoints.end.y - line.linePoints.start.y) * calibration.linearFactor;
      formattedValue = linear(Math.hypot(deltaX, deltaY));
      detailRows = [
        {labelKey: keys.angle, value: degrees(Math.atan2(deltaY, deltaX), calibration.precision)},
        {labelKey: keys.axisX, value: linear(Math.abs(deltaX))},
        {labelKey: keys.axisY, value: linear(Math.abs(deltaY))}
      ];
      break;
    }
    case 'perimeter': {
      if (annotation.type !== PdfAnnotationSubtype.POLYLINE) return null;
      const vertices = (annotation as PdfPolylineAnnoObject).vertices;
      formattedValue = linear(calculator.perimeter(vertices, calibration));
      detailRows = [
        {labelKey: keys.segments, value: String(Math.max(0, vertices.length - 1))},
        ...vertices.slice(1).map((point, index) => ({
          labelKey: keys.segment,
          value: `${index + 1}: ${linear(calculator.distance(vertices[index], point, calibration))}`,
          highlight: {kind: 'segment' as const, index}
        }))
      ];
      break;
    }
    case 'area': {
      if (annotation.type !== PdfAnnotationSubtype.POLYGON) return null;
      const vertices = (annotation as PdfPolygonAnnoObject).vertices;
      const closed = vertices.length ? [...vertices, vertices[0]] : vertices;
      formattedValue = area(calculator.polygonArea(vertices, calibration));
      detailRows = [
        {labelKey: keys.perimeter, value: linear(calculator.perimeter(closed, calibration))},
        {labelKey: keys.vertices, value: String(vertices.length)},
        ...vertices.map((point, index) => {
          const nextIndex = (index + 1) % vertices.length;
          return {
            labelKey: keys.vertex,
            value: `${index + 1}: ${linear(calculator.distance(point, vertices[nextIndex], calibration))}`,
            highlight: {kind: 'vertex' as const, index}
          };
        })
      ];
      break;
    }
    case 'rectangle-area': {
      if (annotation.type !== PdfAnnotationSubtype.SQUARE) return null;
      const width = Math.abs(annotation.rect.size.width) * calibration.linearFactor;
      const height = Math.abs(annotation.rect.size.height) * calibration.linearFactor;
      formattedValue = area(width * height);
      detailRows = [
        {labelKey: keys.width, value: linear(width)},
        {labelKey: keys.height, value: linear(height)},
        {labelKey: keys.perimeter, value: linear(2 * (width + height))}
      ];
      break;
    }
    case 'ellipse': {
      if (annotation.type !== PdfAnnotationSubtype.CIRCLE) return null;
      const horizontalAxis = Math.abs(annotation.rect.size.width) * calibration.linearFactor;
      const verticalAxis = Math.abs(annotation.rect.size.height) * calibration.linearFactor;
      const isArea = isAreaMeasurement(annotation);
      formattedValue = isArea
        ? area(calculator.ellipseArea(annotation.rect.size, calibration))
        : linear(calculator.ellipsePerimeter(annotation.rect.size, calibration));
      detailRows = [
        {labelKey: keys.horizontalAxis, value: linear(horizontalAxis)},
        {labelKey: keys.verticalAxis, value: linear(verticalAxis)},
        {labelKey: keys.area, value: area(calculator.ellipseArea(annotation.rect.size, calibration))},
        {labelKey: keys.perimeter, value: linear(calculator.ellipsePerimeter(annotation.rect.size, calibration))}
      ];
      break;
    }
    case 'arc': {
      if (annotation.type !== PdfAnnotationSubtype.POLYLINE) return null;
      const geometry = arcGeometryFromAnnotation(annotation as PdfPolylineAnnoObject);
      if (!geometry) return null;
      formattedValue = linear(calculator.arcLength(geometry.radius, geometry.sweepRadians, calibration));
      detailRows = [
        {labelKey: keys.radius, value: linear(geometry.radius * calibration.linearFactor)},
        {labelKey: keys.centralAngle, value: formatNumber(geometry.sweepDegrees, calibration.precision, '°')},
        {labelKey: keys.chord, value: linear(geometry.chordLength * calibration.linearFactor)}
      ];
      break;
    }
  }

  return {
    id: annotation.id,
    pageIndex: annotation.pageIndex,
    kind,
    formattedValue,
    detailRows,
    strokeColor: annotation.strokeColor || '#64748b',
    strokeWidth: annotation.strokeWidth || 1,
    calibration,
    rect: annotation.rect
  };
}

function degrees(radians: number, precision: number): string {
  return formatNumber(radians * 180 / Math.PI, precision, '°');
}

function formatNumber(value: number, precision: number, suffix = ''): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  })}${suffix}`;
}
