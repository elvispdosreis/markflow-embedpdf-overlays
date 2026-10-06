import {mountOverlayView, type OverlayViewDependencies, type OverlayViewMount} from '@elvisreis/markflow-core';
export {createOverlayOptions, createCrosshairContext, createGuidesContext, GuidesState} from '@elvisreis/markflow-core';
export type {OverlayViewDependencies, OverlayViewMount, Calibration, CrosshairContext, CrosshairStyle, GuidesContext, Guide, GuideOrientation} from '@elvisreis/markflow-core';
/** Mount only the rulers extension. Call update after changing host options. */
export function mountRulers(host: HTMLElement, options: OverlayViewDependencies): OverlayViewMount {
  return mountOverlayView('rulers', host, options);
}
