import {mountOverlayView, type OverlayViewDependencies, type OverlayViewMount} from '@elvispdosreis/markflow-core';
export {createOverlayOptions, createCrosshairContext, createGuidesContext, GuidesState} from '@elvispdosreis/markflow-core';
export type {OverlayViewDependencies, OverlayViewMount, Calibration, CrosshairContext, CrosshairStyle, GuidesContext, Guide, GuideOrientation} from '@elvispdosreis/markflow-core';
/** Mount only the crosshair extension. Call update after changing host options. */
export function mountCrosshair(host: HTMLElement, options: OverlayViewDependencies): OverlayViewMount {
  return mountOverlayView('crosshair', host, options);
}
