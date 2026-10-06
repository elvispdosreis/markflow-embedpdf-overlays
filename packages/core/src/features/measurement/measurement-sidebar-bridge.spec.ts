import {describe, expect, it, vi} from 'vitest';
import {
  getMeasurementSidebarBridge,
  notifyMeasurementSidebar,
  subscribeMeasurementSidebar,
  registerMeasurementSidebarBridge
} from './measurement-sidebar-bridge';

describe('measurement sidebar Angular bridge', () => {
  it('registers one action set and disposes only its own registration', () => {
    const actions = {
      snapshot: () => ({items: [], selectedId: null}),
      navigate: vi.fn(),
      translate: (_documentId: string, _key: string, fallback: string) => fallback
    };
    const first = {...actions, fallbackCalibration: () => ({linearFactor: 1, unit: 'm' as const, precision: 2})};
    const second = {...actions, fallbackCalibration: () => ({linearFactor: 2, unit: 'cm' as const, precision: 1})};

    const disposeFirst = registerMeasurementSidebarBridge(first);
    const disposeSecond = registerMeasurementSidebarBridge(second);
    disposeFirst();

    expect(getMeasurementSidebarBridge()).toBe(second);
    disposeSecond();
    expect(getMeasurementSidebarBridge()).toBeNull();
  });

  it('notifies mounted sidebar views and releases disconnected views', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMeasurementSidebar(listener);

    notifyMeasurementSidebar();
    unsubscribe();
    notifyMeasurementSidebar();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
