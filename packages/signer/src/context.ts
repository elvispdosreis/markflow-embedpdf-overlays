import type {DocumentManagerCapability, PluginRegistry} from '@embedpdf/snippet';
import type {RotateCapability} from '@embedpdf/plugin-rotate';
import type {SignerContext} from './state';
import type {QuarterTurn} from './geometry';
/** Reads only public EmbedPDF APIs. Viewer rotation never changes signing coordinates. */
export function createSignerContext(registry: PluginRegistry): SignerContext | null {
  const documents = registry.getPlugin('document-manager')?.provides?.() as DocumentManagerCapability | undefined;
  const rotate = registry.getPlugin('rotate')?.provides?.() as RotateCapability | undefined;
  if (!documents) return null;
  return {
    getPage: (id, index) => {
      if (documents.getActiveDocumentId() !== id) return null;
      const state = documents.getDocumentState(id);
      const page = state?.document?.pages.find(page => page.index === index);
      return page ? {index: page.index, size: {...page.size}, rotation: page.rotation,
        viewRotation: (state?.rotation ?? 0) as QuarterTurn} : null;
    },
    subscribe: listener => {
      const disposers = [documents.onDocumentOpened(listener), documents.onDocumentClosed(listener),
        documents.onActiveDocumentChanged(listener), rotate?.onRotateChange(listener)];
      return () => disposers.forEach(dispose => dispose?.());
    },
    onDocumentClosed: listener => documents.onDocumentClosed(listener)
  };
}
