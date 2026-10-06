import type {ZoomCapability} from '@embedpdf/plugin-zoom';

export interface ViewerZoomControlsOptions {
  root: ShadowRoot;
  viewer: HTMLElement;
  getViewport(): HTMLElement | null;
  getActiveDocumentId(): string | null;
  zoom: ZoomCapability;
  step?: number;
  wheelIdleMs?: number;
}

/** Dispose before remounting and when the viewer is destroyed. */
export function mountViewerZoomControls(options: ViewerZoomControlsOptions): () => void {
  const {root, viewer, zoom, getViewport, getActiveDocumentId, step = 0.2, wheelIdleMs = 150} = options;
  const abort = new AbortController();
  let lastWheelZoom: {time: number; direction: number; documentId: string} | undefined;

  const handleViewerWheel = (event: WheelEvent): void => {
    if ((!event.ctrlKey && !event.metaKey) || event.deltaY === 0) return;
    const viewport = getViewport();
    if (!viewport || !event.composedPath().includes(viewport)) return;
    const documentId = getActiveDocumentId();
    if (!documentId) return;

    // Capture before EmbedPDF's bubbling wheel handler so it cannot accumulate
    // its delta-based scale. Ordinary wheel and touch pinch never enter here.
    event.preventDefault();
    event.stopPropagation();
    const direction = event.deltaY < 0 ? 1 : -1;
    const previous = lastWheelZoom;
    lastWheelZoom = {time: event.timeStamp, direction, documentId};
    // One step per wheel burst, using the native 150ms idle boundary by default.
    // A reversal starts a new step immediately, even inside the same burst.
    if (previous?.documentId === documentId && previous.direction === direction
      && event.timeStamp - previous.time < wheelIdleMs) return;

    const scope = zoom.forDocument(documentId);
    const bounds = viewport.getBoundingClientRect();
    scope.requestZoom(Number((scope.getState().currentZoomLevel + direction * step).toFixed(3)), {
      vx: event.clientX - bounds.left,
      vy: event.clientY - bounds.top
    });
  };

  const handleViewerZoomShortcut = (event: KeyboardEvent): void => {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey || !viewer.isConnected) return;
    const direction = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd' ? 1
      : event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract' ? -1 : 0;
    if (!direction) return;
    const documentId = getActiveDocumentId();
    if (!documentId) return;

    // Capture before the viewer commands and cancel the browser's page zoom.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    const scope = zoom.forDocument(documentId);
    scope.requestZoom(Number((scope.getState().currentZoomLevel + direction * step).toFixed(3)));
  };

  root.addEventListener('wheel', handleViewerWheel as EventListener, {capture: true, passive: false, signal: abort.signal});
  window.addEventListener('keydown', handleViewerZoomShortcut, {capture: true, signal: abort.signal});
  return () => abort.abort();
}
