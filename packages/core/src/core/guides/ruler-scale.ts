import type {Calibration} from '../measurement/measurement.models';

export interface RulerTick {
  /** Position in unrotated page coordinates. */
  position: number;
  major: boolean;
  label?: string;
}

/** Nearest readable step from the conventional 1-2-5 scale. */
export function niceMajorStep(scale: number, linearFactor: number, targetPixels = 60): number {
  const target = targetPixels * linearFactor / Math.max(scale, Number.EPSILON);
  const power = 10 ** Math.floor(Math.log10(Math.max(target, Number.EPSILON)));
  const candidates = [1, 2, 5, 10].map(value => value * power);
  return candidates.find(value => value >= target) ?? 10 * power;
}

export function createRulerTicks(pageExtent: number, scale: number, calibration: Calibration): RulerTick[] {
  if (pageExtent <= 0 || calibration.linearFactor <= 0) return [];
  const majorReal = niceMajorStep(scale, calibration.linearFactor);
  const majorPage = majorReal / calibration.linearFactor;
  const minorPage = majorPage / 5;
  const count = Math.ceil(pageExtent / minorPage);
  const ticks: RulerTick[] = [];
  for (let index = 0; index <= count; index++) {
    const position = index * minorPage;
    if (position > pageExtent + 1e-8) break;
    const major = index % 5 === 0;
    ticks.push({position, major, label: major ? formatTick(position * calibration.linearFactor) : undefined});
  }
  return ticks;
}

export function formatRulerPosition(position: number, calibration: Calibration): string {
  return `${(position * calibration.linearFactor).toLocaleString('pt-BR', {
    minimumFractionDigits: calibration.precision,
    maximumFractionDigits: calibration.precision
  })} ${calibration.unit}`;
}

function formatTick(value: number): string {
  return value.toLocaleString('pt-BR', {maximumFractionDigits: 4});
}
