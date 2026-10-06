import {PdfAnnotationName, PdfAnnotationSubtype, type AnnotationTool, type PdfTextAnnoObject} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {createTechnicalCommentTool} from './technical-comment-tool';

describe('technical comment tool', () => {
  it('uses the native sticky-note handler and commits a numbered, typed PDF annotation', () => {
    const baseAnnotation: PdfTextAnnoObject = {
      id: 'new-comment', pageIndex: 1, type: PdfAnnotationSubtype.TEXT,
      rect: {origin: {x: 8, y: 18}, size: {width: 24, height: 24}},
      contents: '', opacity: 1
    };
    const baseTool = {
      id: 'textComment', defaults: {type: PdfAnnotationSubtype.TEXT},
      interaction: {exclusive: false},
      pointerHandler: {
        annotationType: PdfAnnotationSubtype.TEXT,
        create: (context: {onCommit(annotation: PdfTextAnnoObject): void}) => ({
          onPointerDown: () => context.onCommit(baseAnnotation)
        })
      }
    } as unknown as AnnotationTool<PdfTextAnnoObject>;
    const committed: PdfTextAnnoObject[] = [];
    const tool = createTechnicalCommentTool(baseTool, () => 7, () => 'error');
    const handlers = tool.pointerHandler!.create({
      pageIndex: 1, pageSize: {width: 500, height: 500}, scale: 1,
      onCommit: (annotation: PdfTextAnnoObject) => committed.push(annotation)
    } as never);
    handlers.onPointerDown?.({x: 20, y: 30}, {} as never, 'markflow-technical-comment');

    expect(tool.id).toBe('markflow-technical-comment');
    expect(committed[0]).toMatchObject({
      id: 'new-comment', type: PdfAnnotationSubtype.TEXT,
      intent: 'MarkFlowTechnicalComment', subject: 'MarkFlowComment:error:7',
      contents: '7 · Novo comentário', name: PdfAnnotationName.Comment,
      rect: {origin: {x: 8, y: 18}, size: {width: 24, height: 24}},
      custom: {technicalComment: {kind: 'error', number: 7, body: ''}}
    });
  });
});
