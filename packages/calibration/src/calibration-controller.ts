import {CalibrationController as HeadlessCalibrationController, MeasurementCalculator} from '@elvisreis/markflow-core/calibration';

/** The visual calibration extension starts at 1:100; imported scales remain authoritative. */
export class CalibrationController extends HeadlessCalibrationController {
  constructor(calculator = new MeasurementCalculator()) {
    super(calculator);
    this.draft = {...this.draft, preset: 100, realValue: 100};
    this.apply();
  }
}
