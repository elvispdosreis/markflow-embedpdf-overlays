import {PdfAnnotationName, PdfAnnotationSubtype, type AnnotationTool, type PdfTextAnnoObject} from '@embedpdf/snippet';
import {
  decorateTechnicalComment,
  TECHNICAL_COMMENT_TOOL_ID,
  technicalCommentFromAnnotation,
  type TechnicalCommentKind
} from './technical-comment.models';

export function createTechnicalCommentTool(
  baseTool: AnnotationTool<PdfTextAnnoObject>,
  nextNumber: () => number,
  selectedKind: () => TechnicalCommentKind
): AnnotationTool<PdfTextAnnoObject> {
  const baseHandler = baseTool.pointerHandler;
  if (!baseHandler) throw new Error('Ferramenta de comentário PDF sem interação de ponteiro.');
  return {
    ...baseTool,
    id: TECHNICAL_COMMENT_TOOL_ID,
    name: 'Comentário técnico',
    labelKey: 'markflow.technicalComments.tool',
    categories: ['annotation', 'technical-comment'],
    matchScore: annotation => technicalCommentFromAnnotation(annotation) ? 100 : 0,
    interaction: {...baseTool.interaction, isResizable: false, isRotatable: false},
    defaults: {
      ...baseTool.defaults,
      type: PdfAnnotationSubtype.TEXT,
      contents: 'Novo comentário',
      name: PdfAnnotationName.Comment,
      color: '#0369a1',
      strokeColor: '#0369a1'
    },
    behavior: {...baseTool.behavior, editAfterCreate: false, selectAfterCreate: true, deactivateToolAfterCreate: false},
    pointerHandler: {
      annotationType: PdfAnnotationSubtype.TEXT,
      create(context) {
        return baseHandler.create({
          ...context,
          onCommit: (annotation, createContext) => context.onCommit(
            decorateTechnicalComment(annotation, selectedKind(), nextNumber(), ''), createContext
          )
        });
      }
    }
  };
}
