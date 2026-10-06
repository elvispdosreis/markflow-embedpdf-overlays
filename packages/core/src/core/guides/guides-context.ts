import {restorePosition, type Position, type Rect, type Rotation} from '@embedpdf/models';
import type {DocumentManagerCapability, PluginRegistry} from '@embedpdf/snippet';
import type {InteractionManagerCapability} from '@embedpdf/plugin-interaction-manager';
import type {ScrollCapability} from '@embedpdf/plugin-scroll';
import type {CrosshairContext} from '../crosshair/crosshair-context';
import type {Guide} from './guides-state';

export interface GuidesContext extends CrosshairContext {
  getContentRect(documentId: string, pageIndex: number, rect: Rect): Rect | null;
  getRotation(documentId: string, pageIndex: number): Rotation;
  setCursor(cursor: string | null, owner?: string): void;
  onDocumentClosed(listener: (documentId: string) => void): () => void;
}

export function createGuidesContext(base: CrosshairContext, registry: PluginRegistry): GuidesContext {
  const documents = registry.getPlugin('document-manager')!.provides!() as DocumentManagerCapability;
  const scroll = registry.getPlugin('scroll')!.provides!() as ScrollCapability;
  const interaction = registry.getPlugin('interaction-manager')!.provides!() as InteractionManagerCapability;
  return {
    ...base,
    getContentRect: (id, pageIndex, rect) => scroll.forDocument(id).getRectPositionForPage(pageIndex, rect),
    getRotation: (id, pageIndex) => {
      const state = documents.getDocumentState(id);
      return (((state?.document?.pages[pageIndex]?.rotation ?? 0) + (state?.rotation ?? 0)) % 4) as Rotation;
    },
    setCursor: (cursor, owner = 'cad-guides') => cursor ? interaction.setCursor(owner, cursor, 100) : interaction.removeCursor(owner),
    onDocumentClosed: listener => documents.onDocumentClosed(listener)
  };
}

export function guideRect(guide: Guide, size: Rect['size']): Rect {
  return guide.orientation === 'horizontal'
    ? {origin: {x: 0, y: guide.position}, size: {width: size.width, height: 0}}
    : {origin: {x: guide.position, y: 0}, size: {width: 0, height: size.height}};
}

/** Same public inverse transform used by EmbedPDF's PagePointerProvider. */
export function guidePagePoint(point: Position, pageRect: Rect, rotation: Rotation, scale: number): Position {
  return restorePosition(pageRect.size, {x: point.x - pageRect.origin.x, y: point.y - pageRect.origin.y}, rotation, scale);
}
