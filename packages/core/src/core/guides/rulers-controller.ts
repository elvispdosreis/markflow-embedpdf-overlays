import type {Position, Size} from '@embedpdf/models';
import {findViewerContent, findViewerViewport, overlayGeometry} from '../crosshair/overlay-geometry';
import type {Calibration} from '../measurement/measurement.models';
import {guidePagePoint, guideRect, type GuidesContext} from './guides-context';
import type {GuideDragActivity, GuideViewportOffset} from './guides-interaction';
import {GuidesState, type Guide, type GuideOrientation} from './guides-state';
import {createRulerTicks, formatRulerPosition} from './ruler-scale';

interface TickDrawing {position: number; major: boolean; label?: string}
export interface RulerDrawing {
  width: number; height: number; viewerLeft: number; viewerTop: number;
  pageIndex: number | null; topTicks: TickDrawing[]; leftTicks: TickDrawing[];
  preview: {x1: number; y1: number; x2: number; y2: number; label: string; x: number; y: number;
    orientation: 'horizontal' | 'vertical'; removing: boolean} | null;
}
interface RulerGesture {orientation: GuideOrientation; pointerId: number; pageIndex: number | null; point: Position | null; size: Size | null}

export interface RulersControllerOptions {
  context: GuidesContext;
  host: HTMLElement;
  state: GuidesState;
  calibration(): Calibration;
  activity(): GuideDragActivity | null;
  interactionLocked(): boolean;
  onDrawing(drawing: RulerDrawing | null): void;
  onLocked(locked: boolean): void;
  onCreated(): void;
  onViewportChange(offset: GuideViewportOffset | null): void;
}
export interface RulersController {
  schedule(): void;
  destroy(): void;
  start(orientation: GuideOrientation, event: PointerEvent): void;
}

/** Framework-independent interaction and projection; the host supplies drawing callbacks. */
export function mountRulersController(options: RulersControllerOptions): RulersController {
  const {context, state} = options;
  const root = context.viewer.shadowRoot;
  if (!root) return {schedule: () => {}, destroy: () => {}, start: () => {}};
  let destroyed = false;
  let schedule: () => void = () => {};
  let begin: ((orientation: GuideOrientation, event: PointerEvent) => void) | null = null;
  let viewport = findViewerViewport(root);
  let content: HTMLElement | null = null;
  let contentStyle: Pick<CSSStyleDeclaration, 'marginLeft' | 'marginTop' | 'width' | 'height'> | null = null;
  let activePage: number | null = null;
  let gesture: RulerGesture | null = null;
  let publishedViewport = '';
  let frame: number | undefined;
  let settleFrame: number | undefined;
  const abort = new AbortController();
  const publishViewport = (value: GuideViewportOffset | null) => {
    const key = value ? `${value.left}:${value.top}` : '';
    if (key === publishedViewport) return;
    publishedViewport = key;
    options.onViewportChange(value);
  };
  const restoreContent = () => {
    if (!content || !contentStyle) return;
    content.style.marginLeft = contentStyle.marginLeft;
    content.style.marginTop = contentStyle.marginTop;
    content.style.width = contentStyle.width;
    content.style.height = contentStyle.height;
  };
  const syncContentInset = () => {
    const candidate = content?.contains(viewport) ? content : viewport ? findViewerContent(viewport) : null;
    if (candidate !== content) {
      restoreContent();
      content = candidate;
      contentStyle = content ? {
        marginLeft: content.style.marginLeft, marginTop: content.style.marginTop,
        width: content.style.width, height: content.style.height
      } : null;
    }
    if (!content || !contentStyle) return;
    if (!state.enabled()) { restoreContent(); return; }
    content.style.marginLeft = '28px';
    content.style.marginTop = '28px';
    content.style.width = 'calc(100% - 28px)';
    content.style.height = 'calc(100% - 28px)';
  };
  const cancelGesture = () => {gesture = null; context.setCursor(null, 'cad-rulers'); schedule();};
  const hostRect = () => options.host.getBoundingClientRect();
  const geometry = () => viewport ? overlayGeometry(context, viewport) : null;
  const screenPages = () => {
    const active = context.getDocument(); const g = geometry();
    if (!active || !g) return [];
    return context.getLayout().pageIndexes.flatMap(pageIndex => {
      const rect = context.getPageRect(active.id, pageIndex);
      const size = active.pages.find(page => page.index === pageIndex)?.size;
      return rect && size ? [{pageIndex, size, rect: {
        origin: {x: g.originX + rect.origin.x * g.sx, y: g.originY + rect.origin.y * g.sy},
        size: {width: rect.size.width * g.sx, height: rect.size.height * g.sy}
      }}] : [];
    });
  };
  const pageAt = (x: number, y: number) => {
    const g = geometry();
    if (!g || x < g.innerLeft || x > g.right || y < g.innerTop || y > g.bottom) return undefined;
    return screenPages().find(page => x >= page.rect.origin.x && x <= page.rect.origin.x + page.rect.size.width
      && y >= page.rect.origin.y && y <= page.rect.origin.y + page.rect.size.height);
  };
  const pointAt = (event: PointerEvent, pageIndex: number): Position | null => {
    const active = context.getDocument(); const g = geometry(); const rect = active && context.getPageRect(active.id, pageIndex);
    return active && g && rect ? guidePagePoint({x: (event.clientX - g.originX) / g.sx, y: (event.clientY - g.originY) / g.sy}, rect,
      context.getRotation(active.id, pageIndex), active.scale) : null;
  };
  const lineFor = (guide: Guide, size: Size) => {
    const active = context.getDocument(); const g = geometry();
    const rect = active && context.getContentRect(active.id, guide.pageIndex, guideRect(guide, size));
    return active && g && rect ? {
      x1: g.originX + rect.origin.x * g.sx, y1: g.originY + rect.origin.y * g.sy,
      x2: g.originX + (rect.origin.x + rect.size.width) * g.sx, y2: g.originY + (rect.origin.y + rect.size.height) * g.sy
    } : null;
  };
  const render = () => {
    syncContentInset();
    const active = context.getDocument(); const g = geometry(); const own = hostRect();
    if (!active || !g || !state.enabled()) {options.onDrawing(null); publishViewport(null); return;}
    const current = state.get(active.id); options.onLocked(current.guidesLocked || options.interactionLocked());
    const pages = screenPages();
    if (!pages.some(page => page.pageIndex === activePage)) activePage = pages[0]?.pageIndex ?? null;
    const page = pages.find(item => item.pageIndex === activePage);
    const rulerOriginX = g.innerLeft;
    const rulerOriginY = g.innerTop;
    const base: RulerDrawing = {width: Math.max(0, g.right - rulerOriginX), height: Math.max(0, g.bottom - rulerOriginY),
      viewerLeft: rulerOriginX - own.left, viewerTop: rulerOriginY - own.top, pageIndex: activePage,
      topTicks: [], leftTicks: [], preview: null};
    publishViewport({left: base.viewerLeft, top: base.viewerTop});
    if (page) {
      const rotation = context.getRotation(active.id, page.pageIndex);
      const topUsesX = rotation % 2 === 0;
      const topExtent = topUsesX ? page.size.width : page.size.height;
      const leftExtent = topUsesX ? page.size.height : page.size.width;
      const projectTick = (position: number, top: boolean) => {
        const sourceFor = (value: number) => top
          ? topUsesX ? {x: value, y: 0} : {x: 0, y: value}
          : topUsesX ? {x: 0, y: value} : {x: value, y: 0};
        const source = sourceFor(position);
        const point = context.getContentRect(active.id, page.pageIndex, {origin: source, size: {width: 0, height: 0}});
        const nativeZero = context.getContentRect(active.id, page.pageIndex, {origin: sourceFor(0), size: {width: 0, height: 0}});
        if (!point || !nativeZero) return NaN;
        return top
          ? page.rect.origin.x - rulerOriginX + Math.abs(point.origin.x - nativeZero.origin.x) * g.sx
          : page.rect.origin.y - rulerOriginY + Math.abs(point.origin.y - nativeZero.origin.y) * g.sy;
      };
      base.topTicks = createRulerTicks(topExtent, active.scale, options.calibration()).map(tick => ({...tick, position: projectTick(tick.position, true)})).filter(tick => Number.isFinite(tick.position));
      base.leftTicks = createRulerTicks(leftExtent, active.scale, options.calibration()).map(tick => ({...tick, position: projectTick(tick.position, false)})).filter(tick => Number.isFinite(tick.position));
    }
    const selectedGuide = current.guides.find(guide => guide.id === current.selectedId);
    const activity = options.activity() ?? (selectedGuide ? {
      pageIndex: selectedGuide.pageIndex, orientation: selectedGuide.orientation,
      position: selectedGuide.position, removing: false
    } : null);
    if (gesture || activity) {
      const pageIndex = gesture?.pageIndex ?? activity?.pageIndex ?? null;
      const target = pages.find(item => item.pageIndex === pageIndex);
      const position = gesture?.point
        ? gesture.orientation === 'horizontal' ? gesture.point.y : gesture.point.x
        : activity?.position;
      const orientation = gesture?.orientation ?? activity?.orientation;
      if (target && position !== undefined && orientation) {
        const transient: Guide = {id: 'preview', pageIndex: target.pageIndex, orientation, position};
        const line = lineFor(transient, target.size);
        const vertical = line && Math.abs(line.x2 - line.x1) < .1;
        const visible = line && (vertical
          ? line.x1 >= rulerOriginX && line.x1 <= g.right
          : line.y1 >= rulerOriginY && line.y1 <= g.bottom);
        if (line && visible) {
          const clipped = vertical
            ? {...line, y1: rulerOriginY, y2: g.bottom}
            : {...line, x1: rulerOriginX, x2: g.right};
          base.preview = {
          x1: clipped.x1 - own.left, y1: clipped.y1 - own.top,
          x2: clipped.x2 - own.left, y2: clipped.y2 - own.top,
          x: vertical ? clipped.x1 - own.left : rulerOriginX - own.left + 2,
          y: vertical ? rulerOriginY - own.top - 14 : clipped.y1 - own.top,
          orientation: vertical ? 'vertical' : 'horizontal',
          label: formatRulerPosition(transient.position, options.calibration()), removing: activity?.removing ?? false};
        }
      }
    }
    options.onDrawing(base);
  };
  schedule = () => {if (destroyed) return; if (frame === undefined) frame = requestAnimationFrame(() => {frame = undefined; render();});};
  const scheduleSettled = () => {
    schedule();
    if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
    settleFrame = requestAnimationFrame(() => {settleFrame = undefined; schedule();});
  };
  const move = (event: PointerEvent) => {
    if (options.interactionLocked()) {cancelGesture(); return;}
    if (!viewport?.isConnected) viewport = findViewerViewport(root);
    const page = pageAt(event.clientX, event.clientY);
    if (page) activePage = page.pageIndex;
    if (gesture) {
      gesture.pageIndex = page?.pageIndex ?? null;
      gesture.size = page?.size ?? null;
      gesture.point = page ? pointAt(event, page.pageIndex) : null;
      event.preventDefault();
    }
    schedule();
  };
  const up = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    move(event);
    if (!gesture) return;
    const active = context.getDocument();
    if (active && gesture.pageIndex !== null && gesture.point && gesture.size && !state.get(active.id).guidesLocked && !options.interactionLocked()) {
      state.add(active.id, gesture.pageIndex, gesture.orientation, gesture.point, gesture.size); options.onCreated();
    }
    gesture = null; context.setCursor(null, 'cad-rulers'); event.preventDefault(); schedule();
  };
  begin = (orientation, event) => {
    const active = context.getDocument();
    if (!active || state.get(active.id).guidesLocked || options.interactionLocked() || event.button !== 0) return;
    gesture = {orientation, pointerId: event.pointerId, pageIndex: null, point: null, size: null};
    context.setCursor(orientation === 'horizontal' ? 'ns-resize' : 'ew-resize', 'cad-rulers');
    event.preventDefault(); event.stopPropagation(); schedule();
  };
  root.addEventListener('pointermove', move as EventListener, {capture: true, signal: abort.signal});
  window.addEventListener('pointermove', move, {capture: true, signal: abort.signal});
  window.addEventListener('pointerup', up, {capture: true, signal: abort.signal});
  window.addEventListener('pointercancel', cancelGesture, {capture: true, signal: abort.signal});
  window.addEventListener('blur', cancelGesture, {signal: abort.signal});
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !gesture) return;
    cancelGesture(); event.preventDefault(); event.stopPropagation();
  }, {capture: true, signal: abort.signal});
  const unsubscribeState = state.subscribe(() => schedule());
  const unsubscribe = context.subscribe(scheduleSettled);
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    abort.abort();
    unsubscribeState();
    unsubscribe();
    restoreContent();
    context.setCursor(null, 'cad-rulers');
    gesture = null;
    begin = null;
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
    options.onDrawing(null);
    publishViewport(null);
  };
  render();
  return {schedule, destroy, start: (orientation, event) => begin?.(orientation, event)};
}
