import {PdfAnnotationSubtype, type PdfFreeTextAnnoObject, type PdfTextAnnoObject} from '@embedpdf/models';
import type {AnnotationCapability, AnnotationTool} from '@embedpdf/plugin-annotation';
import type {UICapability} from '@embedpdf/plugin-ui';
import {createTechnicalCommentTool} from './technical-comment-tool';
import {
  TECHNICAL_COMMENT_TOOL_ID, technicalCommentFromAnnotation, nextTechnicalCommentNumber,
  convertLegacyTechnicalComment, updateTechnicalComment as updateCommentAnnotation,
  type TechnicalCommentKind
} from './technical-comment.models';

export interface TechnicalCommentControllerOptions {
  annotation: AnnotationCapability;
  ui?: UICapability;
  getActiveDocumentId(): string | null;
  getCreationKind(): TechnicalCommentKind;
  beforeActivate(): void;
  onChange(): void;
}

/** Tool lifecycle and comment edits; host supplies UI notifications and transient state. */
export class TechnicalCommentController {
  constructor(private readonly options: TechnicalCommentControllerOptions) {}
  updateTechnicalComment(documentId: string, id: string, patch: {kind?: TechnicalCommentKind; body?: string}): void {
    const scope = this.options.annotation?.forDocument(documentId);
    const annotation = scope?.getAnnotations().find(item => item.object.id === id)?.object;
    if (!scope || !annotation || !technicalCommentFromAnnotation(annotation)) return;
    if (annotation.type === PdfAnnotationSubtype.FREETEXT) {
      const converted = convertLegacyTechnicalComment(annotation);
      if (!converted) return;
      scope.deleteAnnotation(annotation.pageIndex, id);
      scope.createAnnotation(converted.pageIndex, updateCommentAnnotation(converted, patch));
    } else {
      scope.updateAnnotation(annotation.pageIndex, id, updateCommentAnnotation(annotation as PdfTextAnnoObject, patch));
    }
    this.options.onChange();
  }

  registerTechnicalCommentTool(): void {
    if (!this.options.annotation || this.options.annotation.getTool(TECHNICAL_COMMENT_TOOL_ID)) return;
    const baseTool = this.options.annotation.getTool('textComment') as AnnotationTool<PdfTextAnnoObject> | undefined;
    if (!baseTool) throw new Error('Ferramenta de comentário PDF indisponível.');
    this.options.annotation.addTool(createTechnicalCommentTool(
      baseTool,
      () => {
        const documentId = this.options.getActiveDocumentId();
        const annotations = documentId
          ? this.options.annotation?.forDocument(documentId).getAnnotations()
          : this.options.annotation?.getAnnotations();
        return nextTechnicalCommentNumber(annotations?.map(item => item.object) ?? []);
      },
      () => this.options.getCreationKind()
    ));
  }

  migrateLegacyTechnicalComments(documentId: string): void {
    const scope = this.options.annotation?.forDocument(documentId);
    if (!scope) return;
    for (const tracked of scope.getAnnotations()) {
      const source = tracked.object;
      if (source.type === PdfAnnotationSubtype.TEXT && technicalCommentFromAnnotation(source)
        && source.flags?.includes('noZoom')) {
        scope.updateAnnotation(source.pageIndex, source.id, {
          flags: source.flags.filter(flag => flag !== 'noZoom')
        });
        continue;
      }
      if (source.type !== PdfAnnotationSubtype.FREETEXT) continue;
      const converted = convertLegacyTechnicalComment(source as PdfFreeTextAnnoObject);
      if (!converted) continue;
      scope.deleteAnnotation(source.pageIndex, source.id);
      scope.createAnnotation(converted.pageIndex, converted);
    }
    this.options.onChange();
  }

  toggleTechnicalCommentTool(documentId: string): void {
    const scope = this.options.annotation?.forDocument(documentId);
    if (!scope) return;
    const active = scope.getActiveTool()?.id === TECHNICAL_COMMENT_TOOL_ID;
    scope.setActiveTool(active ? null : TECHNICAL_COMMENT_TOOL_ID);
    if (!active) {
      this.options.beforeActivate();
      this.options.ui?.forDocument(documentId)
        .setActiveSidebar('right', 'main', 'markflow-technical-comments-sidebar');
    }
    this.options.onChange();
  }

}

