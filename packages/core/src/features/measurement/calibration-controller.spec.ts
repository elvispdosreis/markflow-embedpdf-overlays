import {describe, expect, it} from 'vitest';
import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/models';
import {CalibrationController, normalizeMeasurementPrecision, precisionLabel,
  measurementInputValue, recalibrateMeasurementRecords} from './calibration-controller';
import {MeasurementCalculator} from './measurement-calculator';
import type {MeasurementRecord} from './measurement.models';

describe('CalibrationController', () => {
  it('keeps unapplied edits out of the applied snapshot and resets them when reopening', () => {
    const model = new CalibrationController();
    model.draft.preset = 100;
    expect(model.appliedDraft.preset).toBe(50);
    const snapshot = model.appliedDraft; snapshot.preset = 200;
    model.resetDraft(); expect(model.draft.preset).toBe(50);
    model.draft.preset = 100; const change = model.apply()!;
    expect(change.current.linearFactor).toBeCloseTo(change.previous.linearFactor * 2);
    expect(change.summary).toBe('Escala 1:100 · metros (m)');
    model.draft.preset = 200; expect(model.appliedDraft.preset).toBe(100);
  });

  it('supports equivalent custom scales across paper and real units', () => {
    const model = new CalibrationController();
    const preset = model.calibration.linearFactor;
    model.draft = {...model.draft, mode: 'custom', paperValue: 0.1, paperUnit: 'cm', realValue: 0.05, realUnit: 'm'};
    const change = model.apply()!;
    expect(change.current.linearFactor).toBeCloseTo(preset);
    expect(change.description).toBe('0,1 cm no papel = 0,05 m reais');
  });

  it.each([0, -1, Infinity, NaN])('rejects invalid preset %s without changing applied calibration', preset => {
    const model = new CalibrationController(), previous = {...model.calibration};
    model.draft.preset = preset;
    expect(model.isValid()).toBe(false); expect(model.apply()).toBeNull();
    expect(model.calibration).toEqual(previous); expect(model.appliedDraft.preset).toBe(50);
  });

  it('validates custom inputs, supported units and precision before applying', () => {
    const model = new CalibrationController();
    model.draft.mode = 'custom'; model.draft.paperValue = 0;
    expect(model.apply()).toBeNull(); model.draft.paperValue = 1; model.draft.realValue = -2;
    expect(model.apply()).toBeNull(); model.draft.realValue = 50; model.draft.precision = 10;
    expect(model.apply()).toBeNull(); model.draft.precision = 2; model.draft.displayUnit = 'invalid' as never;
    expect(model.apply()).toBeNull();
  });

  it('infers known imported scales while respecting explicit custom metadata', () => {
    const model = new CalibrationController(), calculator = new MeasurementCalculator();
    const imported = {linearFactor: calculator.scaleFactor(100, 'cm'), unit: 'cm' as const, precision: 3};
    expect(model.import(imported)!.description).toBe('Escala 1:100');
    expect(model.draft).toMatchObject({mode: 'preset', preset: 100, displayUnit: 'cm', precision: 3});
    model.import({...imported, mode: 'custom', paperValue: 2, paperUnit: 'mm', realValue: 20, realUnit: 'cm'});
    expect(model.appliedDraft).toMatchObject({mode: 'custom', paperValue: 2, realValue: 20});
  });

  it('rejects corrupt imported calibration and preserves the previous state', () => {
    const model = new CalibrationController(), previous = {...model.calibration};
    expect(model.import({linearFactor: -1, unit: 'm', precision: 2})).toBeNull();
    expect(model.import({linearFactor: 1, unit: 'm', precision: Infinity})).toBeNull();
    expect(model.calibration).toEqual(previous);
  });

  it('normalizes precision for both the applied scale and the editable draft', () => {
    const model = new CalibrationController();
    expect(model.setPrecision('4')).toBe(true);
    expect(model.calibration.precision).toBe(4); expect(model.appliedDraft.precision).toBe(4);
    model.resetDraft(); expect(model.draft.precision).toBe(4);
    expect(normalizeMeasurementPrecision(-1)).toBe(0); expect(normalizeMeasurementPrecision(8)).toBe(4);
    expect(model.setPrecision('bad')).toBe(false); expect(model.calibration.precision).toBe(4);
    expect(precisionLabel(0)).toBe('1'); expect(precisionLabel(3)).toBe('0,001');
    expect(measurementInputValue(1.5, {linearFactor: 1, unit: 'm', precision: 2})).toBe('1,50');
  });
});

describe('Calibration result updates', () => {
  it('applies linear scaling to lengths and squared scaling to areas, including ellipse area', () => {
    const calculator = new MeasurementCalculator();
    const records = [{annotationId: 'length', kind: 'distance', quantity: 'length', rawValue: 3},
      {annotationId: 'area', kind: 'area', quantity: 'area', rawValue: 3},
      {annotationId: 'ellipse', kind: 'ellipse', quantity: 'area', rawValue: 3}] as MeasurementRecord[];
    const previous = {linearFactor: 1, unit: 'm' as const, precision: 2};
    const result = recalibrateMeasurementRecords(records, previous, {...previous, linearFactor: 2}, () => undefined, calculator);
    expect(result.map(item => item.rawValue)).toEqual([6, 12, 12]);
    expect(records.map(item => item.rawValue)).toEqual([3, 3, 3]);
  });

  it('preserves annotation-specific calibration when the global scale or precision changes', () => {
    const annotation = {id: 'own', pageIndex: 0, type: PdfAnnotationSubtype.LINE,
      linePoints: {start: {x: 0, y: 0}, end: {x: 3, y: 4}},
      custom: {measurementKind: 'distance', measurementCalibration: {linearFactor: 0.2, unit: 'cm', precision: 1}}
    } as PdfAnnotationObject;
    const result = recalibrateMeasurementRecords([{annotationId: 'own', kind: 'distance', rawValue: 1} as MeasurementRecord],
      {linearFactor: 1, unit: 'm', precision: 2}, {linearFactor: 2, unit: 'm', precision: 4},
      () => annotation, new MeasurementCalculator());
    expect(result[0]).toMatchObject({rawValue: 1, formattedValue: '1,0 cm'});
  });
});
