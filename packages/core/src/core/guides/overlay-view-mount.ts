import {mountCrosshairController, type CrosshairController, type CrosshairDrawing} from '../crosshair/crosshair-controller';
import type {CrosshairContext, CrosshairStyle} from '../crosshair/crosshair-context';
import {mountGuidesController, type GuidesController, type PageDrawing} from './guides-controller';
import {mountRulersController, type RulersController, type RulerDrawing} from './rulers-controller';
import type {GuidesContext} from './guides-context';
import type {GuidesState, GuideOrientation} from './guides-state';
import type {GuideDragActivity, GuideViewportOffset} from './guides-interaction';
import type {Calibration} from '../measurement/measurement.models';
import {renderCrosshairView, renderGuidesView, renderRulersView, clearOverlayView} from './overlay-views';

export interface OverlayViewDependencies {
  context(): GuidesContext | null;
  crosshairContext(): CrosshairContext | null;
  state: GuidesState;
  calibration(): Calibration;
  activity(): GuideDragActivity | null;
  creating(): GuideOrientation | null;
  guidesEnabled(): boolean;
  guidesInteractionLocked(): boolean;
  crosshairEnabled(): boolean;
  crosshairStyle(): CrosshairStyle;
  paused(): boolean;
  onRulerCreated(): void;
  onGuideCreationEnded(): void;
  onGuideSelected(): void;
  onGuideActivity(activity: GuideDragActivity | null): void;
  onViewportChange(offset: GuideViewportOffset | null): void;
}
export type OverlayKind = 'rulers' | 'guides' | 'crosshair';
export interface OverlayViewMount {update(): void; destroy(): void;}

/** Reusable mount for native EmbedPDF overlays, without Angular. Call update when host state changes. */
export function mountOverlayView(kind: OverlayKind, host: HTMLElement, deps: OverlayViewDependencies): OverlayViewMount {
  const root = host.shadowRoot ?? host.attachShadow({mode: 'open'});
  const previousStyle = host.getAttribute('style');
  const previousLabel = host.getAttribute('aria-label'), previousHidden = host.getAttribute('aria-hidden');
  Object.assign(host.style, {position: 'absolute', inset: '0', pointerEvents: 'none',
    zIndex: kind === 'rulers' ? '22' : kind === 'guides' ? '19' : '20'});
  if (kind === 'rulers') host.setAttribute('aria-label', 'Réguas das Guides');
  else host.setAttribute('aria-hidden', 'true');
  let destroyed = false;
  let controller: CrosshairController | GuidesController | RulersController | undefined;
  let mountedContext: CrosshairContext | null | undefined;
  let mountedState: GuidesState | undefined;
  let crosshair: CrosshairDrawing | null = null, pages: PageDrawing[] = [], rulers: RulerDrawing | null = null;
  let viewBox = '0 0 1 1', selectedId: string | null = null, locked = false;
  let style: CrosshairStyle = 'full', calibration: Calibration;
  let activity: GuideDragActivity | null = null, creating: GuideOrientation | null = null;
  let enabled = true, paused = false, interactionLocked = false;
  const draw = () => {
    if (destroyed) return;
    if (kind === 'crosshair') renderCrosshairView(root, crosshair, style);
    else if (kind === 'guides') renderGuidesView(root, pages, viewBox, selectedId);
    else renderRulersView(root, rulers, calibration.unit, locked,
      (orientation, event) => (controller as RulersController | undefined)?.start(orientation, event));
  };
  const update = () => {
    if (destroyed) return;
    // Read every host getter here so reactive adapters can track dependencies.
    style = deps.crosshairStyle(); calibration = deps.calibration(); activity = deps.activity();
    creating = deps.creating(); enabled = deps.guidesEnabled(); paused = deps.paused();
    interactionLocked = deps.guidesInteractionLocked();
    const crosshairEnabled = deps.crosshairEnabled();
    const context = kind === 'crosshair'
      ? crosshairEnabled && !paused ? deps.crosshairContext() : null
      : deps.context();
    if (context !== mountedContext || deps.state !== mountedState) {
      controller?.destroy(); controller = undefined; mountedContext = context;
      mountedState = deps.state;
      crosshair = null; pages = []; rulers = null;
      if (context && kind === 'crosshair') controller = mountCrosshairController({
        context, host, onDrawing: value => {crosshair = value; draw();}
      });
      else if (context && kind === 'guides') controller = mountGuidesController({
        context: context as GuidesContext, host, state: deps.state,
        creating: () => creating, enabled: () => enabled, paused: () => paused,
        interactionLocked: () => interactionLocked,
        onDrawing: value => {pages = value; draw();}, onViewBox: value => {viewBox = value;},
        onSelectedId: value => {selectedId = value;}, onActivity: deps.onGuideActivity,
        onCreationEnded: deps.onGuideCreationEnded, onGuideSelected: deps.onGuideSelected
      });
      else if (context) controller = mountRulersController({
        context: context as GuidesContext, host, state: deps.state,
        calibration: () => calibration, activity: () => activity, interactionLocked: () => interactionLocked,
        onDrawing: value => {rulers = value; draw();}, onLocked: value => {locked = value;},
        onCreated: deps.onRulerCreated, onViewportChange: deps.onViewportChange
      });
    }
    controller?.schedule(); draw();
  };
  const restore = (name: string, value: string | null) => value === null
    ? host.removeAttribute(name) : host.setAttribute(name, value);
  return {update, destroy: () => {
    if (destroyed) return;
    destroyed = true;
    controller?.destroy(); clearOverlayView(root);
    restore('style', previousStyle); restore('aria-label', previousLabel); restore('aria-hidden', previousHidden);
  }};
}
