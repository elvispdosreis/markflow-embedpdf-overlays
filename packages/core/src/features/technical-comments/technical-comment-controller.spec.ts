import {describe, expect, it, vi} from 'vitest';
import {PdfAnnotationSubtype} from '@embedpdf/models';
import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {UICapability} from '@embedpdf/plugin-ui';
import {TechnicalCommentController} from './technical-comment-controller';
import {TECHNICAL_COMMENT_TOOL_ID, decorateTechnicalComment} from './technical-comment.models';

function fixture(annotation: object, ui?: object) {
  const beforeActivate = vi.fn(), onChange = vi.fn();
  const controller = new TechnicalCommentController({
    annotation: annotation as AnnotationCapability, ui: ui as UICapability | undefined,
    getActiveDocumentId: () => 'doc', getCreationKind: () => 'note', beforeActivate, onChange
  });
  return {controller, beforeActivate, onChange};
}

describe('TechnicalCommentController', () => {
  it('activates for the requested document and prepares host state only on activation', () => {
    let active: string | null = null;
    const setActiveTool = vi.fn((value: string | null) => {active = value;});
    const forDocument = vi.fn(() => ({getActiveTool: () => active ? {id: active} : null, setActiveTool}));
    const setActiveSidebar = vi.fn();
    const {controller, beforeActivate, onChange} = fixture({forDocument}, {forDocument: () => ({setActiveSidebar})});
    controller.toggleTechnicalCommentTool('other');
    expect(forDocument).toHaveBeenCalledWith('other');
    expect(setActiveTool).toHaveBeenLastCalledWith(TECHNICAL_COMMENT_TOOL_ID);
    expect(setActiveSidebar).toHaveBeenCalledWith('right', 'main', 'markflow-technical-comments-sidebar');
    controller.toggleTechnicalCommentTool('other');
    expect(setActiveTool).toHaveBeenLastCalledWith(null);
    expect(beforeActivate).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('keeps existing tools and reports a missing native comment tool', () => {
    const addTool = vi.fn();
    fixture({getTool: () => ({}), addTool}).controller.registerTechnicalCommentTool();
    expect(addTool).not.toHaveBeenCalled();
    expect(() => fixture({getTool: () => undefined, addTool}).controller.registerTechnicalCommentTool())
      .toThrow('Ferramenta de comentário PDF indisponível.');
  });

  it('removes the legacy noZoom flag without removing unrelated flags', () => {
    const annotation = decorateTechnicalComment({id: 'comment', pageIndex: 0,
      type: PdfAnnotationSubtype.TEXT} as never, 'note', 1, 'Comentário');
    annotation.flags = ['noZoom', 'print'];
    const updateAnnotation = vi.fn();
    const {controller, onChange} = fixture({forDocument: () => ({
      getAnnotations: () => [{object: annotation}], updateAnnotation
    })});
    controller.migrateLegacyTechnicalComments('doc');
    expect(updateAnnotation).toHaveBeenCalledWith(0, 'comment', {flags: ['print']});
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('ignores an edit to an annotation that is not a technical comment', () => {
    const updateAnnotation = vi.fn();
    const {controller, onChange} = fixture({forDocument: () => ({getAnnotations: () => [{object: {
      id: 'ordinary', pageIndex: 0, type: PdfAnnotationSubtype.TEXT
    }}], updateAnnotation})});
    controller.updateTechnicalComment('doc', 'ordinary', {body: 'Changed'});
    expect(updateAnnotation).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
