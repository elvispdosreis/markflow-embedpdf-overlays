import {Calibration, MeasurementUnit, Point, Rect} from './measurement.models';

const MILLIMETERS_PER_UNIT: Record<MeasurementUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1_000,
  km: 1_000_000,
  in: 25.4,
  ft: 304.8,
  yd: 914.4,
  mi: 1_609_344,
  pt: 25.4 / 72
};

const MILLIMETERS_PER_PDF_POINT = 25.4 / 72;

export class MeasurementCalculator {
  scaleFactor(scaleDenominator: number, displayUnit: MeasurementUnit): number {
    const scale = this.positive(scaleDenominator, 'A escala');
    return MILLIMETERS_PER_PDF_POINT * scale / MILLIMETERS_PER_UNIT[displayUnit];
  }

  customScaleFactor(
    paperValue: number,
    paperUnit: MeasurementUnit,
    displayValue: number,
    realUnit: MeasurementUnit,
    displayUnit: MeasurementUnit
  ): number {
    const paperMillimeters = this.positive(paperValue, 'A medida no papel') * MILLIMETERS_PER_UNIT[paperUnit];
    const realMillimeters = this.positive(displayValue, 'A medida real') * MILLIMETERS_PER_UNIT[realUnit];
    const scaleRatio = realMillimeters / paperMillimeters;
    return MILLIMETERS_PER_PDF_POINT * scaleRatio / MILLIMETERS_PER_UNIT[displayUnit];
  }

  distance(start: Point, end: Point, calibration: Calibration): number {
    return Math.hypot(end.x - start.x, end.y - start.y) * calibration.linearFactor;
  }

  perimeter(points: Point[], calibration: Calibration): number {
    if (points.length < 2) {
      return 0;
    }
    return points.slice(1).reduce(
      (total, point, index) => total + this.distance(points[index], point, calibration),
      0
    );
  }

  polygonArea(points: Point[], calibration: Calibration): number {
    if (points.length < 3) {
      return 0;
    }

    const doubledArea = points.reduce((total, point, index) => {
      const next = points[(index + 1) % points.length];
      return total + point.x * next.y - next.x * point.y;
    }, 0);

    return Math.abs(doubledArea) / 2 * calibration.linearFactor ** 2;
  }

  rectangleArea(rect: Rect, calibration: Calibration): number {
    return Math.abs(rect.width * rect.height) * calibration.linearFactor ** 2;
  }

  ellipseArea(rect: Rect, calibration: Calibration): number {
    return Math.PI * rect.width / 2 * rect.height / 2 * calibration.linearFactor ** 2;
  }

  ellipsePerimeter(rect: Rect, calibration: Calibration): number {
    const a = Math.abs(rect.width) / 2;
    const b = Math.abs(rect.height) / 2;
    if (a === 0 || b === 0) {
      return 0;
    }

    const h = (a - b) ** 2 / (a + b) ** 2;
    const perimeter = Math.PI * (a + b) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));
    return perimeter * calibration.linearFactor;
  }

  arcLength(radius: number, angleRadians: number, calibration: Calibration): number {
    return Math.abs(radius * angleRadians) * calibration.linearFactor;
  }

  format(value: number, calibration: Calibration, squared = false): string {
    const suffix = squared ? `${calibration.unit}²` : calibration.unit;
    return `${value.toLocaleString('pt-BR', {
      minimumFractionDigits: calibration.precision,
      maximumFractionDigits: calibration.precision
    })} ${suffix}`;
  }

  private positive(value: number, label: string): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${label} deve ser maior que zero.`);
    }
    return value;
  }
}
