import type {Calibration} from './measurement.models';
import type {MeasurementSidebarDetailRow, MeasurementSidebarItem} from './measurement-sidebar.models';

export interface MeasurementSidebarSnapshot {
  items: MeasurementSidebarItem[];
  selectedId: string | null;
}

export interface MeasurementSidebarBridge {
  fallbackCalibration(): Calibration;
  snapshot(documentId: string): MeasurementSidebarSnapshot;
  navigate(documentId: string, item: MeasurementSidebarItem): void;
  highlightDetail?(documentId: string, item: MeasurementSidebarItem, row: MeasurementSidebarDetailRow | null): void;
  deleteVertex?(documentId: string, item: MeasurementSidebarItem, index: number): void;
  deleteSegment?(documentId: string, item: MeasurementSidebarItem, index: number): void;
  deleteMeasurement?(documentId: string, item: MeasurementSidebarItem): void;
  translate(documentId: string, key: string, fallback: string): string;
  setPrecision?(item: MeasurementSidebarItem, value: number): void;
  setStrokeColor?(kind: 'distance' | 'arc', value: string): void;
  setStrokeWidth?(kind: 'distance' | 'arc', value: number): void;
  setDistanceValue?(value: string): void;
  setDistanceAngle?(value: string): void;
}

let activeBridge: MeasurementSidebarBridge | null = null;
const listeners = new Set<() => void>();

export function registerMeasurementSidebarBridge(bridge: MeasurementSidebarBridge): () => void {
  activeBridge = bridge;
  return () => {
    if (activeBridge === bridge) activeBridge = null;
  };
}

export function getMeasurementSidebarBridge(): MeasurementSidebarBridge | null {
  return activeBridge;
}

export function subscribeMeasurementSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyMeasurementSidebar(): void {
  for (const listener of listeners) listener();
}
