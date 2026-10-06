import type {RegisterAlwaysOptions} from '@embedpdf/plugin-interaction-manager';
import type {CrosshairContext} from './crosshair-context';
import {findViewerViewport, overlayGeometry} from './overlay-geometry';

export interface CrosshairDrawing {
  viewBox: string;
  left: number; top: number; width: number; height: number;
  x: number; y: number;
}

export interface CrosshairControllerOptions {
  context: CrosshairContext;
  host: HTMLElement;
  onDrawing(drawing: CrosshairDrawing | null): void;
}
export interface CrosshairController {
  schedule(): void;
  destroy(): void;
}

/** Framework-independent interaction and projection; the host supplies drawing callbacks. */
export function mountCrosshairController(options: CrosshairControllerOptions): CrosshairController {
  const {context} = options;
  const root = context.viewer.shadowRoot;
  if (!root) return {schedule: () => {}, destroy: () => {}};
  let destroyed = false;
  let documentId: string | null = null;
  let viewport: HTMLElement | null = findViewerViewport(root);
  let pointer: {x: number; y: number} | null = null;
  let frame: number | undefined;
  const registrations = new Map<number, () => void>();
  const abort = new AbortController();
  const clear = () => {pointer = null; options.onDrawing(null);};
  const schedule = () => {
    if (destroyed) return;
    if (frame === undefined) frame = requestAnimationFrame(() => {
      frame = undefined;
      syncPages();
      render();
    });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(context.viewer);
  if (viewport) observer.observe(viewport);
  const refreshViewport = () => {
    const element = findViewerViewport(root);
    if (element && viewport !== element) {
      if (viewport) observer.unobserve(viewport);
      viewport = element;
      observer.observe(viewport);
    }
  };
  const nativePointer: NonNullable<RegisterAlwaysOptions['handlers']['onPointerMove']> = (_position, event) => {
    pointer = {x: event.clientX, y: event.clientY};
    schedule();
  };
  const syncPages = () => {
    const active = context.getDocument();
    if (active?.id !== documentId) {
      registrations.forEach(dispose => dispose());
      registrations.clear();
      documentId = active?.id ?? null;
      clear();
    }
    if (!active) return;
    const indexes = new Set(context.getLayout().pageIndexes);
    registrations.forEach((dispose, index) => {
      if (!indexes.has(index)) {dispose(); registrations.delete(index);}
    });
    indexes.forEach(pageIndex => {
      if (registrations.has(pageIndex)) return;
      registrations.set(pageIndex, context.interaction.registerAlways({
        scope: {type: 'page', documentId: active.id, pageIndex},
        handlers: {onPointerEnter: nativePointer, onPointerMove: nativePointer,
          onPointerLeave: schedule, onPointerCancel: clear}
      }));
    });
  };
  const render = () => {
    options.onDrawing(null);
    const active = context.getDocument();
    if (!active || !pointer || context.isGated()) return;
    const {x, y} = pointer;
    if (!viewport?.isConnected) refreshViewport();
    if (!viewport?.isConnected) return;
    const outerHit = document.elementFromPoint(x, y);
    if (outerHit !== context.viewer && !context.viewer.contains(outerHit)) return;
    const hit = root.elementFromPoint(x, y);
    if (!hit || !viewport.contains(hit) || hit.closest('button, input, select, textarea, [role="menu"], [role="dialog"]')) return;
    const geometry = overlayGeometry(context, viewport);
    if (!geometry) return;
    const {host, innerLeft, innerTop, right, bottom} = geometry;
    const own = options.host.getBoundingClientRect();
    const left = Math.max(innerLeft, host.left, own.left);
    const top = Math.max(innerTop, host.top, own.top);
    if (x < left || x >= right || y < top || y >= bottom) return;
    options.onDrawing({viewBox: `0 0 ${own.width} ${own.height}`,
      left: left - own.left, top: top - own.top, width: right - left, height: bottom - top,
      x: x - left, y: y - top});
  };
  syncPages();
  const unsubscribe = context.subscribe(() => {refreshViewport(); schedule();});
  // Native annotation handles stop bubbling. Passive capture observes them without changing gestures.
  root.addEventListener('pointermove', event => {
    if (!(event instanceof MouseEvent)) return;
    if ('pointerType' in event && event.pointerType === 'touch') {clear(); return;}
    pointer = {x: event.clientX, y: event.clientY};
    schedule();
  }, {capture: true, passive: true, signal: abort.signal});
  context.viewer.addEventListener('pointerleave', clear, {passive: true, signal: abort.signal});
  root.addEventListener('pointercancel', clear, {capture: true, passive: true, signal: abort.signal});
  window.addEventListener('blur', clear, {signal: abort.signal});
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    abort.abort();
    unsubscribe();
    observer.disconnect();
    registrations.forEach(dispose => dispose());
    if (frame !== undefined) cancelAnimationFrame(frame);
    options.onDrawing(null);
  };
  return {schedule, destroy};
}
