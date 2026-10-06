import {PdfAnnotationName, PdfAnnotationSubtype, type PdfFreeTextAnnoObject, type PdfTextAnnoObject} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {
  decorateTechnicalComment,
  convertLegacyTechnicalComment,
  nextTechnicalCommentNumber,
  technicalCommentFromAnnotation,
  technicalCommentsFromAnnotations,
  updateTechnicalComment
} from './technical-comment.models';

const plainText: PdfFreeTextAnnoObject = {
  id: 'comment-1', pageIndex: 2, type: PdfAnnotationSubtype.FREETEXT,
  rect: {origin: {x: 120, y: 80}, size: {width: 170, height: 30}},
  contents: '', fontFamily: 4, fontSize: 12,
  fontColor: '#111827', textAlign: 0,
  verticalAlign: 0, opacity: 1
};

const stickyNote: PdfTextAnnoObject = {
  id: 'comment-1', pageIndex: 2, type: PdfAnnotationSubtype.TEXT,
  rect: {origin: {x: 120, y: 80}, size: {width: 24, height: 24}},
  contents: '', opacity: 1
};

describe('technical comments', () => {
  it('projects only technical comments and sorts them by persistent number', () => {
    const third = decorateTechnicalComment({...stickyNote, id: 'third'}, 'question', 3, 'Conferir o beiral');
    const first = decorateTechnicalComment({...stickyNote, id: 'first'}, 'error', 1, 'Medida irregular');
    const comments = technicalCommentsFromAnnotations([third, plainText, first]);

    expect(comments.map(comment => [comment.number, comment.kind, comment.color, comment.body]))
      .toEqual([
        [1, 'error', '#dc2626', 'Medida irregular'],
        [3, 'question', '#d97706', 'Conferir o beiral']
      ]);
    expect(nextTechnicalCommentNumber([third, plainText, first])).toBe(4);
    expect(nextTechnicalCommentNumber([third, plainText])).toBe(4);
  });

  it('recovers the number, type and body from native PDF fields when custom metadata is absent', () => {
    const annotation = decorateTechnicalComment(stickyNote, 'note', 12, 'Indicar camada de corte');
    const imported = {...annotation, custom: undefined, intent: undefined};

    expect(technicalCommentFromAnnotation(imported)).toMatchObject({
      id: 'comment-1', pageIndex: 2, number: 12, kind: 'note',
      body: 'Indicar camada de corte', color: '#0369a1'
    });
    expect(annotation.contents).toBe('12 · Indicar camada de corte');
    expect(annotation.subject).toBe('MarkFlowComment:note:12');
    expect(annotation.flags).toEqual(['print', 'noRotate']);
  });

  it('keeps resolved comments green when native PDF metadata is reloaded', () => {
    const resolved = decorateTechnicalComment(stickyNote, 'resolved', 13, 'Cota corrigida');
    expect(resolved).toMatchObject({
      subject: 'MarkFlowComment:resolved:13', color: '#35c46a', strokeColor: '#35c46a'
    });
    expect(technicalCommentFromAnnotation({...resolved, custom: undefined, intent: undefined})).toMatchObject({
      kind: 'resolved', number: 13, body: 'Cota corrigida', color: '#35c46a'
    });
    expect(updateTechnicalComment(decorateTechnicalComment(stickyNote, 'error', 13, 'Cota corrigida'), {kind: 'resolved'}))
      .toMatchObject({subject: 'MarkFlowComment:resolved:13', strokeColor: '#35c46a'});
  });

  it('updates type and body without changing identity, page, position or number', () => {
    const original = decorateTechnicalComment(stickyNote, 'error', 5, 'Rever cota');
    const updated = updateTechnicalComment(original, {kind: 'question', body: 'Essa cota está correta?'});

    expect(updated).toMatchObject({
      id: 'comment-1', pageIndex: 2, rect: stickyNote.rect,
      subject: 'MarkFlowComment:question:5', contents: '5 · Essa cota está correta?',
      strokeColor: '#d97706', name: PdfAnnotationName.Comment,
      custom: {technicalComment: {kind: 'question', number: 5, body: 'Essa cota está correta?'}}
    });
    expect(technicalCommentFromAnnotation(updated)?.number).toBe(5);
  });

  it('moves an old FreeText comment to a 24-point native icon at the visible pin center', () => {
    const legacy = {...plainText, intent: 'MarkFlowTechnicalComment', subject: 'MarkFlowComment:error:4', contents: '4 · Rever acesso'};
    const converted = convertLegacyTechnicalComment(legacy);
    expect(converted).toMatchObject({
      id: legacy.id, type: PdfAnnotationSubtype.TEXT, name: PdfAnnotationName.Comment,
      rect: {origin: {x: 193, y: 83}, size: {width: 24, height: 24}},
      contents: '4 · Rever acesso'
    });
  });
});
