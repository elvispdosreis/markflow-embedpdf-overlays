import type {LineEndings, PdfAnnotationBorderStyle} from '@embedpdf/snippet';
import type {MeasurementKind} from './measurement.models';
import type {MeasurementStyleProperty} from './measurement-style.models';
import type {MeasurementFillPattern} from './measurement-fill';

export interface MeasurementStyleValues {
  color?: string;
  fillPattern?: MeasurementFillPattern;
  opacity?: number;
  strokeColor?: string;
  strokeStyle?: PdfAnnotationBorderStyle | number;
  strokeWidth?: number;
  lineEndings?: LineEndings;
  rotation?: number;
}

export interface MeasurementStyleSnapshot {
  kind: MeasurementKind;
  label: string;
  mode: 'selection' | 'defaults';
  values: MeasurementStyleValues;
}

export interface MeasurementStyleBridge {
  snapshot(documentId: string): MeasurementStyleSnapshot | null;
  update(documentId: string, property: MeasurementStyleProperty, value: unknown): void;
  colorPresets(): string[];
  translate(documentId: string, key: string, fallback: string): string;
}

let activeBridge: MeasurementStyleBridge | null = null;
const listeners = new Set<() => void>();

export function registerMeasurementStyleBridge(bridge: MeasurementStyleBridge): () => void {
  activeBridge = bridge;
  return () => {
    if (activeBridge === bridge) activeBridge = null;
  };
}

export function getMeasurementStyleBridge(): MeasurementStyleBridge | null {
  return activeBridge;
}

export function subscribeMeasurementStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyMeasurementStyle(): void {
  for (const listener of listeners) listener();
}
