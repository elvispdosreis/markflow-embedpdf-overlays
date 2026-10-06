import type {InteractionManagerCapability, RegisterAlwaysOptions} from '@embedpdf/plugin-interaction-manager';
import type {ScrollCapability} from '@embedpdf/plugin-scroll';
import type {ViewportCapability} from '@embedpdf/plugin-viewport';
import type {ZoomCapability} from '@embedpdf/plugin-zoom';
import type {RotateCapability} from '@embedpdf/plugin-rotate';
import type {DocumentManagerCapability, PluginRegistry, Rect, UICapability} from '@embedpdf/snippet';

export type CrosshairStyle = 'small' | 'full';

export interface CrosshairContext {
  viewer: HTMLElement;
  interaction: {registerAlways(options: RegisterAlwaysOptions): () => void};
  getDocument(): {id: string; scale: number; pages: {index: number; size: Rect['size']}[]} | null;
  getPageRect(documentId: string, pageIndex: number): Rect | null;
  getLayout(): {width: number; pageIndexes: number[]};
  getViewportGap(): number;
  isGated(): boolean;
  subscribe(listener: () => void): () => void;
}

/** Public EmbedPDF capabilities; no private selectors, annotation objects or coordinate engine. */
export function createCrosshairContext(viewer: HTMLElement, registry: PluginRegistry): CrosshairContext | null {
  const capability = <T>(name: string) => registry.getPlugin(name)?.provides?.() as T | undefined;
  const documents = capability<DocumentManagerCapability>('document-manager');
  const interaction = capability<InteractionManagerCapability>('interaction-manager');
  const scroll = capability<ScrollCapability>('scroll');
  const viewport = capability<ViewportCapability>('viewport');
  const zoom = capability<ZoomCapability>('zoom');
  const rotate = capability<RotateCapability>('rotate');
  const ui = capability<UICapability>('ui');
  if (!documents || !interaction || !scroll || !viewport) return null;
  return {
    viewer, interaction,
    getDocument: () => {
      const id = documents.getActiveDocumentId();
      const state = id ? documents.getDocumentState(id) : null;
      // Activation precedes page/plugin initialization when replacing a PDF.
      if (!state?.document) return null;
      const zoomScale = id ? zoom?.forDocument?.(id)?.getState().currentZoomLevel : undefined;
      return {id: state.document.id, scale: zoomScale ?? state.scale, pages: state.document.pages};
    },
    getPageRect: (id, index) => {
      const page = documents.getDocumentState(id)?.document?.pages[index];
      return page ? scroll.forDocument(id).getRectPositionForPage(index, {origin: {x: 0, y: 0}, size: page.size}) : null;
    },
    getLayout: () => {
      const id = documents.getActiveDocumentId();
      if (!id) return {width: 0, pageIndexes: []};
      const scope = scroll.forDocument(id);
      return {width: scope.getLayout().totalContentSize.width, pageIndexes: scope.getMetrics().visiblePages.map(page => page - 1)};
    },
    getViewportGap: () => viewport.getViewportGap(),
    isGated: () => viewport.isGated() || interaction.isPaused(),
    subscribe: listener => {
      const subscriptions = [
        documents.onDocumentOpened(listener), documents.onDocumentClosed(listener), documents.onActiveDocumentChanged(listener),
        scroll.onScroll(listener), scroll.onLayoutChange(listener), scroll.onLayoutReady(listener),
        viewport.onViewportChange(listener), viewport.onViewportResize(listener), viewport.onGateChange(listener),
        interaction.onStateChange(listener), zoom?.onZoomChange(listener), rotate?.onRotateChange(listener),
        ui?.onToolbarChanged(listener), ui?.onSidebarChanged(listener), ui?.onMenuChanged(listener), ui?.onModalChanged(listener)
      ];
      return () => subscriptions.forEach(dispose => dispose?.());
    }
  };
}
