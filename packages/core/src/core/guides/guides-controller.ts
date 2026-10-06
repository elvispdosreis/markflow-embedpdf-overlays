import type {Position, Rect, Size} from '@embedpdf/models';
import {findViewerViewport, overlayGeometry} from '../crosshair/overlay-geometry';
import {guidePagePoint, guideRect, type GuidesContext} from './guides-context';
import {GUIDE_RULER_SIZE, type GuideDragActivity} from './guides-interaction';
import {GuidesState, type Guide, type GuideOrientation} from './guides-state';

export interface PageDrawing {
  pageIndex: number;
  rect: Rect;
  clip: {left: number; top: number; right: number; bottom: number};
  lines: {guide: Guide; x1: number; y1: number; x2: number; y2: number;
    hitX1: number; hitY1: number; hitX2: number; hitY2: number}[];
}
interface Gesture {
  documentId: string; pageIndex: number; pointerId: number; target: Element;
  guide: Guide | null; orientation: GuideOrientation; offset: number; point: Position; size: Size;
  removing: boolean;
}

export interface GuidesControllerOptions {
  context: GuidesContext;
  host: HTMLElement;
  state: GuidesState;
  creating(): GuideOrientation | null;
  enabled(): boolean;
  paused(): boolean;
  interactionLocked(): boolean;
  onDrawing(drawing: PageDrawing[]): void;
  onViewBox(viewBox: string): void;
  onSelectedId(id: string | null): void;
  onActivity(activity: GuideDragActivity | null): void;
  onCreationEnded(): void;
  onGuideSelected(): void;
}
export interface GuidesController {
  schedule(): void;
  destroy(): void;
}

/** Framework-independent interaction and projection; the host supplies drawing callbacks. */
export function mountGuidesController(options: GuidesControllerOptions): GuidesController {
  const {context, state} = options;
  const root = context.viewer.shadowRoot;
  if (!root) return {schedule: () => {}, destroy: () => {}};
  let destroyed = false;
  let schedule: () => void = () => {};
  let viewport: HTMLElement | null = findViewerViewport(root);
  let activeId: string | null = null;
  let frame: number | undefined;
  let settleFrame: number | undefined;
  let gesture: Gesture | null = null;
  let swallowClick = false;
  const abort = new AbortController();
  const refreshViewport = () => {
    const found = findViewerViewport(root);
    if (found && found !== viewport) { viewport = found; observer.observe(found); }
  };
  const release = () => {
    if (gesture?.target.hasPointerCapture?.(gesture.pointerId)) gesture.target.releasePointerCapture(gesture.pointerId);
    if (gesture?.guide) options.onActivity(null);
    gesture = null;
    context.setCursor(null);
  };
  const project = (): PageDrawing[] => {
    const active = context.getDocument();
    const geometry = viewport ? overlayGeometry(context, viewport) : null;
    if (!active || !geometry) return [];
    const {originX, originY, sx, sy} = geometry;
    const own = options.host.getBoundingClientRect();
    const content = {left: geometry.innerLeft - own.left, top: geometry.innerTop - own.top,
      right: geometry.right - own.left, bottom: geometry.bottom - own.top};
    options.onViewBox(`0 0 ${own.width} ${own.height}`);
    return context.getLayout().pageIndexes.flatMap(pageIndex => {
      const rect = context.getPageRect(active.id, pageIndex);
      const size = active.pages.find(page => page.index === pageIndex)?.size;
      if (!rect || !size) return [];
      const left = originX + rect.origin.x * sx - own.left;
      const top = originY + rect.origin.y * sy - own.top;
      const clip = {
        left: Math.max(left, geometry.innerLeft - own.left, 0), top: Math.max(top, geometry.innerTop - own.top, 0),
        right: Math.min(left + rect.size.width * sx, geometry.right - own.left),
        bottom: Math.min(top + rect.size.height * sy, geometry.bottom - own.top)
      };
      if (clip.right <= clip.left || clip.bottom <= clip.top) return [];
      const lines = state.forPage(active.id, pageIndex).flatMap(guide => {
        const line = context.getContentRect(active.id, pageIndex, guideRect(guide, size));
        if (!line) return [];
        const hitX1 = Math.max(originX + line.origin.x * sx - own.left, clip.left);
        const hitY1 = Math.max(originY + line.origin.y * sy - own.top, clip.top);
        const hitX2 = Math.min(originX + (line.origin.x + line.size.width) * sx - own.left, clip.right);
        const hitY2 = Math.min(originY + (line.origin.y + line.size.height) * sy - own.top, clip.bottom);
        const vertical = Math.abs(line.size.width * sx) < .1;
        return vertical
          ? [{guide, x1: hitX1, y1: content.top, x2: hitX1, y2: content.bottom, hitX1, hitY1, hitX2, hitY2}]
          : [{guide, x1: content.left, y1: hitY1, x2: content.right, y2: hitY1, hitX1, hitY1, hitX2, hitY2}];
      });
      return [{pageIndex, rect, clip, lines}];
    });
  };
  const pagePoint = (event: MouseEvent, pageIndex: number): Position | null => {
    const active = context.getDocument();
    const geometry = viewport ? overlayGeometry(context, viewport) : null;
    const rect = active ? context.getPageRect(active.id, pageIndex) : null;
    if (!active || !geometry || !rect) return null;
    return guidePagePoint({x: (event.clientX - geometry.originX) / geometry.sx, y: (event.clientY - geometry.originY) / geometry.sy},
      rect, context.getRotation(active.id, pageIndex), active.scale);
  };
  const render = () => {
    if (!viewport?.isConnected) refreshViewport();
    const active = context.getDocument();
    if (activeId !== active?.id) {
      release(); activeId = active?.id ?? null;
      if (options.creating()) options.onCreationEnded();
    }
    const current = active ? state.get(active.id) : null;
    if (!options.enabled() || options.paused() || options.interactionLocked() || context.isGated() || !current?.guidesVisible || (gesture?.guide && current.guidesLocked)) release();
    if (gesture?.guide && !gesture.removing) state.move(gesture.documentId, gesture.guide.id, gesture.point, gesture.size);
    options.onSelectedId(current?.selectedId ?? null);
    options.onDrawing(!options.enabled() || options.paused() || context.isGated() || !current?.guidesVisible ? [] : project());
  };
  schedule = () => {
    if (destroyed) return;
    if (frame === undefined) frame = requestAnimationFrame(() => { frame = undefined; render(); });
  };
  const scheduleSettled = () => {
    schedule();
    if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
    settleFrame = requestAnimationFrame(() => {settleFrame = undefined; schedule();});
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(context.viewer);
  if (viewport) observer.observe(viewport);
  const consume = (event: Event) => {event.preventDefault(); event.stopPropagation();};
  const canInteract = () => options.enabled() && !options.paused() && !options.interactionLocked() && !context.isGated();
  const returnedToRuler = (event: MouseEvent, orientation: GuideOrientation) => {
    const host = viewport?.getBoundingClientRect();
    if (!host) return false;
    return orientation === 'horizontal'
      ? event.clientY >= host.top - GUIDE_RULER_SIZE && event.clientY <= host.top
      : event.clientX >= host.left - GUIDE_RULER_SIZE && event.clientX <= host.left;
  };
  const locate = (event: MouseEvent) => {
    const host = options.host.getBoundingClientRect();
    const x = event.clientX - host.left, y = event.clientY - host.top;
    const page = project().find(p => x >= p.clip.left && x <= p.clip.right && y >= p.clip.top && y <= p.clip.bottom);
    const line = page?.lines.slice().reverse().find(l => l.x1 === l.x2 ? Math.abs(x - l.x1) <= 3 : Math.abs(y - l.y1) <= 3);
    return {page, line};
  };
  const down = (raw: Event) => {
    if (!(raw instanceof MouseEvent) || raw.button !== 0 || !canInteract()) return;
    const active = context.getDocument();
    if (!active || !viewport?.contains(raw.target as Node)) return;
    if ((raw.target as Element)?.closest('button, input, textarea, select, [role="menu"], [role="dialog"], [contenteditable="true"]')) return;
    swallowClick = false;
    const {page, line} = locate(raw);
    const current = state.get(active.id);
    const orientation = options.creating();
    const guide = !orientation && current.guidesVisible && !current.guidesLocked ? line?.guide : null;
    if (!page || (!orientation && !guide)) {state.select(active.id, null); return;}
    const point = pagePoint(raw, page.pageIndex);
    const size = active.pages.find(p => p.index === page.pageIndex)?.size;
    if (!point || !size || !(raw.target instanceof Element)) return;
    const axis = orientation ?? guide!.orientation;
    const pointerId = (raw as PointerEvent).pointerId;
    gesture = {documentId: active.id, pageIndex: page.pageIndex, pointerId, target: raw.target,
      guide: guide ?? null, orientation: axis, point, size,
      offset: guide ? (axis === 'horizontal' ? point.y : point.x) - guide.position : 0, removing: false};
    raw.target.setPointerCapture?.(pointerId);
    if (guide) {state.select(active.id, guide.id); options.onGuideSelected();}
    consume(raw); swallowClick = true; schedule();
  };
  const move = (raw: Event) => {
    if (!(raw instanceof MouseEvent)) return;
    if (!canInteract()) {release(); return;}
    if (gesture && (raw as PointerEvent).pointerId === gesture.pointerId) {
      const point = pagePoint(raw, gesture.pageIndex);
      if (point) gesture.point = gesture.orientation === 'horizontal' ? {...point, y: point.y - gesture.offset} : {...point, x: point.x - gesture.offset};
      if (gesture.guide) {
        gesture.removing = returnedToRuler(raw, gesture.orientation);
        options.onActivity({pageIndex: gesture.pageIndex, orientation: gesture.orientation,
          position: gesture.orientation === 'horizontal' ? gesture.point.y : gesture.point.x, removing: gesture.removing});
      }
      consume(raw);
    } else {
      const active = context.getDocument();
      const current = active ? state.get(active.id) : null;
      const {line, page} = locate(raw);
      context.setCursor(options.creating() && page ? 'crosshair' : current?.guidesVisible && !current.guidesLocked && !options.interactionLocked() && line ? line.x1 === line.x2 ? 'ew-resize' : 'ns-resize' : null);
    }
    schedule();
  };
  const up = (raw: Event) => {
    if (!(raw instanceof MouseEvent) || !gesture || (raw as PointerEvent).pointerId !== gesture.pointerId) return;
    move(raw);
    if (!gesture) return;
    if (gesture.guide && gesture.removing) state.remove(gesture.documentId, gesture.guide.id);
    else if (gesture.guide) state.move(gesture.documentId, gesture.guide.id, gesture.point, gesture.size);
    else {
      state.add(gesture.documentId, gesture.pageIndex, gesture.orientation, gesture.point, gesture.size);
      options.onCreationEnded();
    }
    release(); consume(raw); schedule();
  };
  root.addEventListener('pointerdown', down, {capture: true, signal: abort.signal});
  root.addEventListener('pointermove', move, {capture: true, signal: abort.signal});
  root.addEventListener('pointerup', up, {capture: true, signal: abort.signal});
  root.addEventListener('pointercancel', () => {release(); schedule();}, {capture: true, signal: abort.signal});
  for (const name of ['mousedown', 'mouseup', 'click', 'dblclick']) root.addEventListener(name, event => {
    if (swallowClick) consume(event);
    if (name === 'click') swallowClick = false;
  }, {capture: true, signal: abort.signal});
  root.addEventListener('scroll', schedule, {capture: true, passive: true, signal: abort.signal});
  context.viewer.addEventListener('pointerleave', () => {if (!gesture) context.setCursor(null);}, {signal: abort.signal});
  window.addEventListener('blur', release, {signal: abort.signal});
  window.addEventListener('keydown', event => {
    if (event.composedPath().some(target => target instanceof Element && target.matches('input, textarea, select, [contenteditable="true"]'))) return;
    const active = context.getDocument();
    if (!active || !canInteract()) return;
    if (event.key === 'Escape' && (gesture || options.creating() || state.get(active.id).selectedId)) {
      release(); state.select(active.id, null); options.onCreationEnded(); consume(event); schedule();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && state.removeSelected(active.id)) {
      release(); consume(event); schedule();
    }
  }, {capture: true, signal: abort.signal});
  const unsubscribeState = state.subscribe(() => schedule());
  const unsubscribe = context.subscribe(() => {refreshViewport(); scheduleSettled();});
  const close = context.onDocumentClosed(id => state.close(id));
  render();
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    abort.abort(); unsubscribeState(); unsubscribe(); close(); observer.disconnect(); release();
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
    schedule = () => {}; options.onDrawing([]);
  };
  return {schedule, destroy};
}
