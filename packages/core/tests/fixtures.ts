import {vi} from 'vitest';
import {GuidesState, type OverlayViewDependencies, type CrosshairContext} from '../src/index';

export function options(): OverlayViewDependencies {
  return {
    state: new GuidesState(), context: () => null, crosshairContext: () => null,
    calibration: () => ({linearFactor: 1, unit: 'm', precision: 2}),
    activity: () => null, creating: () => null, guidesEnabled: () => true,
    guidesInteractionLocked: () => false, crosshairEnabled: () => true,
    crosshairStyle: () => 'full', paused: () => false,
    onRulerCreated: vi.fn(), onGuideCreationEnded: vi.fn(), onGuideSelected: vi.fn(),
    onGuideActivity: vi.fn(), onViewportChange: vi.fn()
  };
}
export function crosshairContext() {
  const viewer = document.createElement('div');
  viewer.attachShadow({mode: 'open'});
  document.body.append(viewer);
  const disposed = vi.fn();
  const registerAlways = vi.fn(() => disposed);
  const unsubscribe = vi.fn();
  const context: CrosshairContext = {
    viewer, interaction: {registerAlways},
    getDocument: () => ({id: 'a', scale: 1, pages: []}),
    getPageRect: () => null, getLayout: () => ({width: 0, pageIndexes: [0]}),
    getViewportGap: () => 0, isGated: () => false,
    subscribe: () => unsubscribe
  };
  vi.stubGlobal('ResizeObserver', class {observe() {} unobserve() {} disconnect() {}});
  return {context, viewer, disposed, registerAlways, unsubscribe};
}
