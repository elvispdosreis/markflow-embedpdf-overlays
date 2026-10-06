import {PdfAnnotationName, PdfAnnotationSubtype, type PdfAnnotationObject, type PdfFreeTextAnnoObject, type PdfTextAnnoObject} from '@embedpdf/snippet';

export type TechnicalCommentKind = 'error' | 'note' | 'question' | 'resolved';

export interface TechnicalComment {
  id: string;
  pageIndex: number;
  rect: PdfAnnotationObject['rect'];
  number: number;
  kind: TechnicalCommentKind;
  body: string;
  color: string;
}

export const TECHNICAL_COMMENT_INTENT = 'MarkFlowTechnicalComment';
export const TECHNICAL_COMMENT_TOOL_ID = 'markflow-technical-comment';
export const TECHNICAL_COMMENT_TYPES: Readonly<Record<TechnicalCommentKind, {color: string; label: string}>> = {
  error: {color: '#dc2626', label: 'Erro'},
  note: {color: '#0369a1', label: 'Anotação'},
  question: {color: '#d97706', label: 'Dúvida'},
  resolved: {color: '#35c46a', label: 'Resolvido'}
};

interface CommentMetadata {
  kind: TechnicalCommentKind;
  number: number;
  body: string;
}

export function technicalCommentFromAnnotation(annotation: PdfAnnotationObject): TechnicalComment | null {
  if (annotation.type !== PdfAnnotationSubtype.TEXT && annotation.type !== PdfAnnotationSubtype.FREETEXT) return null;
  const custom = (annotation.custom as {technicalComment?: Partial<CommentMetadata>} | undefined)?.technicalComment;
  const subject = /^MarkFlowComment:(error|note|question|resolved):([1-9]\d*)$/.exec(annotation.subject ?? '');
  const kind = isKind(custom?.kind) ? custom.kind : subject?.[1];
  const number = Number.isInteger(custom?.number) && Number(custom?.number) > 0
    ? Number(custom?.number) : Number(subject?.[2]);
  if ((!custom && annotation.intent !== TECHNICAL_COMMENT_INTENT && !subject) || !isKind(kind) || !Number.isSafeInteger(number) || number < 1) return null;
  const fallbackBody = (annotation.contents ?? '').replace(new RegExp(`^${number}\\s*[·•-]\\s*`), '').trim();
  const body = typeof custom?.body === 'string' ? custom.body : fallbackBody === 'Novo comentário' ? '' : fallbackBody;
  return {
    id: annotation.id, pageIndex: annotation.pageIndex, rect: annotation.rect,
    number, kind, body, color: TECHNICAL_COMMENT_TYPES[kind].color
  };
}

export function technicalCommentsFromAnnotations(annotations: PdfAnnotationObject[]): TechnicalComment[] {
  return annotations
    .map(technicalCommentFromAnnotation)
    .filter((comment): comment is TechnicalComment => comment !== null)
    .sort((left, right) => left.number - right.number || left.pageIndex - right.pageIndex || left.id.localeCompare(right.id));
}

export function nextTechnicalCommentNumber(annotations: PdfAnnotationObject[]): number {
  return technicalCommentsFromAnnotations(annotations).reduce((max, comment) => Math.max(max, comment.number), 0) + 1;
}

export function decorateTechnicalComment(
  annotation: PdfTextAnnoObject,
  kind: TechnicalCommentKind,
  number: number,
  body: string
): PdfTextAnnoObject {
  const color = TECHNICAL_COMMENT_TYPES[kind].color;
  const trimmedBody = body.trim();
  return {
    ...annotation,
    intent: TECHNICAL_COMMENT_INTENT,
    subject: `MarkFlowComment:${kind}:${number}`,
    contents: `${number} · ${trimmedBody || 'Novo comentário'}`,
    // PDFium exports the standard Comment icon; PushPin currently fails to commit.
    name: PdfAnnotationName.Comment,
    color,
    strokeColor: color,
    opacity: 1,
    flags: ['print', 'noRotate'],
    custom: {
      ...(annotation.custom ?? {}),
      technicalComment: {kind, number, body: trimmedBody} satisfies CommentMetadata
    }
  };
}

export function updateTechnicalComment(
  annotation: PdfTextAnnoObject,
  patch: {kind?: TechnicalCommentKind; body?: string}
): PdfTextAnnoObject {
  const existing = technicalCommentFromAnnotation(annotation);
  if (!existing) throw new Error('A anotação selecionada não é um comentário técnico.');
  return decorateTechnicalComment(annotation, patch.kind ?? existing.kind, existing.number, patch.body ?? existing.body);
}

/** Convert comments made by the old FreeText tool into native PDF sticky notes. */
export function convertLegacyTechnicalComment(annotation: PdfFreeTextAnnoObject): PdfTextAnnoObject | null {
  const comment = technicalCommentFromAnnotation(annotation);
  if (!comment) return null;
  const center = {
    x: annotation.rect.origin.x + annotation.rect.size.width / 2,
    y: annotation.rect.origin.y + annotation.rect.size.height / 2
  };
  const native: PdfTextAnnoObject = {
    id: annotation.id,
    pageIndex: annotation.pageIndex,
    type: PdfAnnotationSubtype.TEXT,
    rect: {origin: {x: center.x - 12, y: center.y - 12}, size: {width: 24, height: 24}},
    author: annotation.author,
    created: annotation.created,
    modified: annotation.modified,
    contents: annotation.contents ?? '',
    opacity: 1,
    custom: annotation.custom
  };
  return decorateTechnicalComment(native, comment.kind, comment.number, comment.body);
}

function isKind(value: unknown): value is TechnicalCommentKind {
  return value === 'error' || value === 'note' || value === 'question' || value === 'resolved';
}
