import type {PluginRegistry, ThumbnailCapability} from '@embedpdf/snippet';
import type {SignerPageDropTarget} from './viewer';

/** Hit-test EmbedPDF 2.15's native thumbnail pane using its public virtual window. */
export function createNativeThumbnailDropTarget(viewer: HTMLElement, registry: PluginRegistry, sidebarId = 'sidebar-panel') {
  const thumbnails = registry.getPlugin('thumbnail')?.provides?.() as ThumbnailCapability | undefined;
  const locate = (point?: {x: number; y: number}, pageIndex?: number): SignerPageDropTarget | null => {
    const sidebar = Array.from(viewer.shadowRoot?.querySelectorAll<HTMLElement>('[data-sidebar-id]') ?? [])
      .find(element => element.dataset.sidebarId === sidebarId);
    // Native Thumbnails renders an inline overflowY:auto pane; no thumbnail UI is recreated.
    const pane = sidebar ? Array.from(sidebar.querySelectorAll<HTMLElement>('div'))
      .find(element => element.style.overflowY === 'auto') : undefined;
    if (!pane || !thumbnails) return null;
    const rect = pane.getBoundingClientRect(), scale = rect.height / pane.clientHeight;
    if (!Number.isFinite(scale) || scale <= 0 || (point && (point.x < rect.left || point.x > rect.right
      || point.y < rect.top || point.y > rect.bottom))) return null;
    const y = point ? (point.y - rect.top) / scale + pane.scrollTop : 0;
    const item = thumbnails.getWindow()?.items.find(item => pageIndex !== undefined ? item.pageIndex === pageIndex
      : y >= item.top && y < item.top + item.wrapperHeight);
    if (!item || !(item.width > 0 && item.height > 0 && pane.clientWidth > 0)) return null;
    // Use the rendered bitmap when available to exclude the native selection border exactly.
    const row = Array.from(pane.querySelectorAll<HTMLElement>('div')).find(element =>
      element.style.position === 'absolute' && parseFloat(element.style.top) === item.top);
    const bitmap = row?.querySelector('img')?.getBoundingClientRect();
    const bounds = bitmap && bitmap.width > 0 && bitmap.height > 0
      ? {left: bitmap.left, top: bitmap.top, width: bitmap.width, height: bitmap.height}
      : {left: rect.left + (pane.clientWidth - item.width) * scale / 2,
        top: rect.top + (item.top + (item.padding ?? 0) - pane.scrollTop) * scale,
        width: item.width * scale, height: item.height * scale};
    if (pageIndex !== undefined && (bounds.top >= rect.bottom || bounds.top + bounds.height <= rect.top)) return null;
    // ThumbMeta describes the actual page bitmap, excluding image padding and the label.
    return {pageIndex: item.pageIndex, bounds, ...(pageIndex !== undefined ? {clipBounds: {
      left: rect.left, top: rect.top, width: rect.width ?? rect.right - rect.left, height: rect.height}} : {})};
  };
  return Object.assign((point: {x: number; y: number}) => locate(point), {
    getPageTarget: (pageIndex: number) => locate(undefined, pageIndex)
  });
}
