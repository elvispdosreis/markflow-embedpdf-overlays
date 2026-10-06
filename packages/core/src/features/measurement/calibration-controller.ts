import type {PdfAnnotationObject} from '@embedpdf/models';
import {MeasurementCalculator} from './measurement-calculator';
import {measurementRecord} from './measurement-record';
import type {Calibration, MeasurementRecord, MeasurementUnit} from './measurement.models';

export type CalibrationMode = 'preset' | 'custom';
export interface CalibrationDraft {
  mode: CalibrationMode;
  preset: number;
  paperValue: number;
  paperUnit: MeasurementUnit;
  realValue: number;
  realUnit: MeasurementUnit;
  displayUnit: MeasurementUnit;
  precision: number;
}
export interface ImportedCalibration extends Calibration {
  mode?: CalibrationMode;
  preset?: number;
  paperValue?: number;
  paperUnit?: MeasurementUnit;
  realValue?: number;
  realUnit?: MeasurementUnit;
}
export interface CalibrationChange {
  previous: Calibration;
  current: Calibration;
  description: string;
  summary: string;
}

export const SCALE_PRESETS = [10, 20, 50, 100, 200, 500, 1_000] as const;
export const PRECISION_OPTIONS = [0, 1, 2, 3, 4] as const;
export const CALIBRATION_UNIT_OPTIONS: ReadonlyArray<{value: MeasurementUnit; label: string}> = [
  {value: 'mm', label: 'Milímetros (mm)'}, {value: 'cm', label: 'Centímetros (cm)'},
  {value: 'm', label: 'Metros (m)'}, {value: 'km', label: 'Quilômetros (km)'}
];
const UNITS = new Set<MeasurementUnit>(['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi', 'pt']);
const positive = (value: number) => Number.isFinite(Number(value)) && Number(value) > 0;
const validPrecision = (value: number) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 4;

/** Draft/applied calibration lifecycle, independent of Angular, viewer UI and XFDF parsing. */
export class CalibrationController {
  calibration: Calibration;
  draft: CalibrationDraft = {mode: 'preset', preset: 50, paperValue: 1, paperUnit: 'mm',
    realValue: 50, realUnit: 'mm', displayUnit: 'm', precision: 2};
  private applied: CalibrationDraft = {...this.draft};
  constructor(private readonly calculator = new MeasurementCalculator()) {
    this.calibration = {linearFactor: calculator.scaleFactor(50, 'm'), unit: 'm', precision: 2};
  }
  get appliedDraft(): CalibrationDraft {return {...this.applied};}
  resetDraft(): void {this.draft = {...this.applied};}

  isValid(): boolean {
    const draft = this.draft;
    if (!UNITS.has(draft.displayUnit) || !validPrecision(draft.precision)) return false;
    if (draft.mode === 'preset') return positive(draft.preset);
    return draft.mode === 'custom' && UNITS.has(draft.paperUnit) && UNITS.has(draft.realUnit)
      && positive(draft.paperValue) && positive(draft.realValue);
  }

  apply(): CalibrationChange | null {
    if (!this.isValid()) return null;
    const draft = this.draft;
    const factor = draft.mode === 'preset' ? this.calculator.scaleFactor(Number(draft.preset), draft.displayUnit)
      : this.calculator.customScaleFactor(Number(draft.paperValue), draft.paperUnit,
        Number(draft.realValue), draft.realUnit, draft.displayUnit);
    if (!positive(factor)) return null;
    const previous = {...this.calibration};
    this.calibration = {linearFactor: factor, unit: draft.displayUnit, precision: Number(draft.precision)};
    this.applied = {...draft};
    return this.change(previous);
  }

  import(imported: ImportedCalibration): CalibrationChange | null {
    if (!positive(imported.linearFactor) || !UNITS.has(imported.unit) || !validPrecision(imported.precision)) return null;
    const previous = {...this.calibration};
    const inferredPreset = SCALE_PRESETS.find(preset =>
      Math.abs(this.calculator.scaleFactor(preset, imported.unit) - imported.linearFactor) < 1e-6);
    this.calibration = {linearFactor: imported.linearFactor, unit: imported.unit, precision: imported.precision};
    this.draft = {mode: imported.mode ?? (imported.preset || inferredPreset ? 'preset' : 'custom'),
      preset: imported.preset ?? inferredPreset ?? this.draft.preset,
      paperValue: imported.paperValue ?? this.draft.paperValue, paperUnit: imported.paperUnit ?? this.draft.paperUnit,
      realValue: imported.realValue ?? this.draft.realValue, realUnit: imported.realUnit ?? this.draft.realUnit,
      displayUnit: imported.unit, precision: imported.precision};
    this.applied = {...this.draft};
    return this.change(previous);
  }

  setPrecision(value: number | string): boolean {
    const precision = normalizeMeasurementPrecision(value);
    if (precision === null) return false;
    this.calibration = {...this.calibration, precision};
    this.draft.precision = precision; this.applied.precision = precision;
    return true;
  }

  private change(previous: Calibration): CalibrationChange {
    const draft = this.applied;
    const format = (value: number) => Number(value).toLocaleString('pt-BR', {maximumFractionDigits: 4});
    const description = draft.mode === 'preset' ? `Escala 1:${draft.preset}`
      : `${format(draft.paperValue)} ${draft.paperUnit} no papel = ${format(draft.realValue)} ${draft.realUnit} reais`;
    const unit = CALIBRATION_UNIT_OPTIONS.find(option => option.value === draft.displayUnit)?.label ?? draft.displayUnit;
    return {previous, current: {...this.calibration}, description,
      summary: `${description} · ${unit.toLocaleLowerCase('pt-BR')}`};
  }
}

export function normalizeMeasurementPrecision(value: number | string): number | null {
  const precision = Number(value);
  return Number.isFinite(precision) ? Math.max(0, Math.min(4, Math.trunc(precision))) : null;
}
export function precisionLabel(precision: number): string {
  return precision === 0 ? '1' : `0,${'0'.repeat(precision - 1)}1`;
}
export function measurementInputValue(value: number, calibration: Calibration): string {
  return value.toLocaleString('pt-BR', {minimumFractionDigits: calibration.precision, maximumFractionDigits: calibration.precision});
}

/** Refresh derived results; annotations with stored calibration keep their own scale/precision. */
export function recalibrateMeasurementRecords(items: readonly MeasurementRecord[], previous: Calibration,
  current: Calibration, getAnnotation: (id: string) => PdfAnnotationObject | undefined,
  calculator: MeasurementCalculator): MeasurementRecord[] {
  const ratio = current.linearFactor / previous.linearFactor;
  return items.map(item => {
    const annotation = getAnnotation(item.annotationId);
    if (annotation?.custom?.['measurementCalibration']) return measurementRecord(annotation, current, calculator) ?? {...item};
    const squared = item.quantity === 'area' || item.kind === 'area' || item.kind === 'rectangle-area';
    const rawValue = item.rawValue * ratio ** (squared ? 2 : 1);
    return {...item, rawValue, formattedValue: calculator.format(rawValue, current, squared)};
  });
}
