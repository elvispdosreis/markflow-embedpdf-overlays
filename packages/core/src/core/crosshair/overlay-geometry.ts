import type {CrosshairContext} from './crosshair-context';

export function findViewerViewport(root: ShadowRoot): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>('*'))
    .filter(element => {
      const style = getComputedStyle(element);
      return /(auto|scroll)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)
        && element.clientWidth > 0 && element.clientHeight > 0;
    })
    .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] ?? null;
}

/** Find the native document box that owns the scroller without relying on EmbedPDF class names. */
export function findViewerContent(viewport: HTMLElement): HTMLElement | null {
  const bounds = viewport.getBoundingClientRect();
  for (let element = viewport.parentElement; element; element = element.parentElement) {
    const candidate = element.getBoundingClientRect();
    if ((element.style.position === 'relative' || getComputedStyle(element).position === 'relative')
      && Math.abs(candidate.left - bounds.left) < 1
      && Math.abs(candidate.top - bounds.top) < 1
      && Math.abs(candidate.width - bounds.width) < 1
      && Math.abs(candidate.height - bounds.height) < 1) return element;
  }
  return null;
}

/** Shared CSS-origin bridge. PDF layout, zoom and rotation remain owned by EmbedPDF. */
export function overlayGeometry(context: CrosshairContext, viewport: HTMLElement) {
  const active = context.getDocument();
  if (!active || !viewport.isConnected) return null;
  const host = context.viewer.getBoundingClientRect();
  const bounds = viewport.getBoundingClientRect();
  const sx = bounds.width / viewport.offsetWidth;
  const sy = bounds.height / viewport.offsetHeight;
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return null;
  const innerLeft = bounds.left + viewport.clientLeft * sx;
  const innerTop = bounds.top + viewport.clientTop * sy;
  const layout = context.getLayout();
  const gap = context.getViewportGap();
  return {
    host, sx, sy, innerLeft, innerTop,
    right: Math.min(innerLeft + viewport.clientWidth * sx, host.right),
    bottom: Math.min(innerTop + viewport.clientHeight * sy, host.bottom),
    originX: innerLeft + (gap + Math.max(0, (viewport.clientWidth - 2 * gap - layout.width * active.scale) / 2) - viewport.scrollLeft) * sx,
    originY: innerTop + (gap - viewport.scrollTop) * sy
  };
}
