import type {OverlayViewDependencies} from './index';

/** Keep callbacks/getters current without discarding document state on every framework render. */
export function liveDependencies(current: () => OverlayViewDependencies): OverlayViewDependencies {
  return {
    get state() {return current().state;},
    context: () => current().context(), crosshairContext: () => current().crosshairContext(),
    calibration: () => current().calibration(), activity: () => current().activity(),
    creating: () => current().creating(), guidesEnabled: () => current().guidesEnabled(),
    guidesInteractionLocked: () => current().guidesInteractionLocked(),
    crosshairEnabled: () => current().crosshairEnabled(), crosshairStyle: () => current().crosshairStyle(),
    paused: () => current().paused(), onRulerCreated: () => current().onRulerCreated(),
    onGuideCreationEnded: () => current().onGuideCreationEnded(), onGuideSelected: () => current().onGuideSelected(),
    onGuideActivity: value => current().onGuideActivity(value), onViewportChange: value => current().onViewportChange(value)
  };
}
