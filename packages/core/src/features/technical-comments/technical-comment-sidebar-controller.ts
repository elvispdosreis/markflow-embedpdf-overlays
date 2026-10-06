import type {AnnotationCapability, AnnotationScope} from '@embedpdf/plugin-annotation';
import type {ScrollCapability, ScrollScope} from '@embedpdf/plugin-scroll';
import {TECHNICAL_COMMENT_TOOL_ID, technicalCommentFromAnnotation, technicalCommentsFromAnnotations,
  type TechnicalComment, type TechnicalCommentKind} from './technical-comment.models';
import type {TechnicalCommentSidebarBridge} from './technical-comment-sidebar-bridge';

export interface TechnicalCommentSidebarControllerOptions {
  getAnnotation(): AnnotationCapability | undefined;
  getScroll(): ScrollCapability | undefined;
  getCreationKind(): TechnicalCommentKind;
  getLegendVisible(): boolean;
  onChange(): void;
  actions: Omit<TechnicalCommentSidebarBridge, 'snapshot' | 'navigate' | 'remove'>;
}

export function createTechnicalCommentSidebarController(options: TechnicalCommentSidebarControllerOptions): TechnicalCommentSidebarBridge {
  return {
    ...options.actions,
    snapshot: documentId => {
      const scope = options.getAnnotation()?.forDocument(documentId);
      const items = technicalCommentsFromAnnotations(scope?.getAnnotations().map(item => item.object) ?? []);
      return {items, selectedId: scope?.getSelectedAnnotationIds().find(id => items.some(item => item.id === id)) ?? null,
        creationKind: options.getCreationKind(), creating: scope?.getActiveTool()?.id === TECHNICAL_COMMENT_TOOL_ID,
        legendVisible: options.getLegendVisible()};
    },
    navigate: (documentId, item) => {
      const annotation = options.getAnnotation()?.forDocument(documentId), scroll = options.getScroll()?.forDocument(documentId);
      if (annotation && scroll) navigateToTechnicalComment(item, annotation, scroll);
    },
    remove: (documentId, id) => {
      const scope = options.getAnnotation()?.forDocument(documentId);
      const annotation = scope?.getAnnotations().find(item => item.object.id === id)?.object;
      if (annotation && technicalCommentFromAnnotation(annotation)) scope?.deleteAnnotation(annotation.pageIndex, id);
      options.onChange();
    }
  };
}

export function navigateToTechnicalComment(item: TechnicalComment,
  annotation: Pick<AnnotationScope, 'selectAnnotation'>, scroll: Pick<ScrollScope, 'scrollToPage'>): void {
  scroll.scrollToPage({pageNumber: item.pageIndex + 1, pageCoordinates: {
    x: item.rect.origin.x + item.rect.size.width / 2, y: item.rect.origin.y + item.rect.size.height / 2
  }, behavior: 'smooth', alignX: 50, alignY: 50});
  annotation.selectAnnotation(item.pageIndex, item.id);
}

export function adjacentTechnicalComment(items: TechnicalComment[], selectedId: string | null,
  direction: -1 | 1): TechnicalComment | null {
  const index = items.findIndex(item => item.id === selectedId);
  if (index < 0) return direction === 1 ? items[0] ?? null : null;
  return items[index + direction] ?? null;
}
