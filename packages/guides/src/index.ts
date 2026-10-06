import {mountOverlayView, type OverlayViewDependencies, type OverlayViewMount} from '@elvispdosreis/markflow-core';
export {createOverlayOptions, createCrosshairContext, createGuidesContext, GuidesState} from '@elvispdosreis/markflow-core';
export type {OverlayViewDependencies, OverlayViewMount, Calibration, CrosshairContext, CrosshairStyle, GuidesContext, Guide, GuideOrientation} from '@elvispdosreis/markflow-core';
/** Mount only the guides extension. Call update after changing host options. */
export function mountGuides(host: HTMLElement, options: OverlayViewDependencies): OverlayViewMount {
  return mountOverlayView('guides', host, options);
}
