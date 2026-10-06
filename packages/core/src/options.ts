import {GuidesState} from './core/guides/guides-state';
import type {OverlayViewDependencies} from './core/guides/overlay-view-mount';
/** Keep the returned options/state for the viewer session, or explicitly provide a stable state. */
export function createOverlayOptions(overrides: Partial<OverlayViewDependencies> = {}): OverlayViewDependencies {
  return {
    state: new GuidesState(),
    context: () => null, crosshairContext: () => null,
    calibration: () => ({linearFactor: 1, unit: 'm', precision: 2}),
    activity: () => null, creating: () => null, guidesEnabled: () => true,
    guidesInteractionLocked: () => false, crosshairEnabled: () => false,
    crosshairStyle: () => 'full', paused: () => false,
    onRulerCreated: () => {}, onGuideCreationEnded: () => {}, onGuideSelected: () => {},
    onGuideActivity: () => {}, onViewportChange: () => {},
    ...overrides
  };
}
