import {PDFArray, PDFDict, PDFDocument, PDFName, PDFStream, PDFString} from 'pdf-lib';
import {describe, expect, it} from 'vitest';
import {addTechnicalCommentPinAppearances} from './technical-comment-pdf';
import type {TechnicalComment} from '../technical-comments/technical-comment.models';

describe('technical comment PDF export', () => {
  it('draws a colored numbered pin while preserving the clickable text annotation', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([300, 300]);
    const annotation = pdf.context.obj({
      Type: 'Annot', Subtype: 'Text', Rect: [20, 40, 44, 64],
      Subj: PDFString.of('MarkFlowComment:error:7'), Contents: PDFString.of('7 · Revisar cota'),
      Name: 'Comment', F: 4
    });
    page.node.addAnnot(pdf.context.register(annotation));
    const namedAnnotation = pdf.context.obj({
      Type: 'Annot', Subtype: 'Text', Rect: [50, 70, 74, 94],
      NM: PDFString.of('comment-8'), Contents: PDFString.of('8 · Conferir escala'), Name: 'Comment', F: 4
    });
    page.node.addAnnot(pdf.context.register(namedAnnotation));
    const resolvedAnnotation = pdf.context.obj({
      Type: 'Annot', Subtype: 'Text', Rect: [90, 70, 114, 94],
      Subj: PDFString.of('MarkFlowComment:resolved:9'), Contents: PDFString.of('9 · Cota corrigida'), Name: 'Comment', F: 4
    });
    page.node.addAnnot(pdf.context.register(resolvedAnnotation));
    const comment: TechnicalComment = {
      id: 'comment-7', pageIndex: 0, rect: {origin: {x: 20, y: 40}, size: {width: 24, height: 24}},
      kind: 'error', number: 7, body: 'Revisar cota', color: '#dc2626'
    };
    const namedComment: TechnicalComment = {
      ...comment, id: 'comment-8', number: 8, kind: 'note', body: 'Conferir escala', color: '#0369a1'
    };
    const resolvedComment: TechnicalComment = {
      ...comment, id: 'comment-9', number: 9, kind: 'resolved', body: 'Cota corrigida', color: '#35c46a'
    };
    const exported = await addTechnicalCommentPinAppearances(await pdf.save(), [comment, namedComment, resolvedComment]);
    const loaded = await PDFDocument.load(exported);
    const saved = loaded.getPage(0).node.Annots()?.lookup(0, PDFDict);
    expect(saved?.lookup(PDFName.of('Subtype'), PDFName)?.toString()).toBe('/Text');
    expect(saved?.lookup(PDFName.of('Contents'), PDFString)?.decodeText()).toBe('7 · Revisar cota');
    const appearanceRef = saved?.lookup(PDFName.of('AP'), PDFDict)?.get(PDFName.of('N'));
    const appearance = loaded.context.lookupMaybe(appearanceRef, PDFStream);
    expect(appearance?.dict.lookup(PDFName.of('BBox'), PDFArray)?.asRectangle()).toEqual({x: 0, y: 0, width: 24, height: 24});
    expect(appearance?.getContentsSize()).toBeGreaterThan(0);
    const savedByName = loaded.getPage(0).node.Annots()?.lookup(1, PDFDict);
    const namedAppearanceRef = savedByName?.lookup(PDFName.of('AP'), PDFDict)?.get(PDFName.of('N'));
    expect(loaded.context.lookupMaybe(namedAppearanceRef, PDFStream)?.getContentsSize()).toBeGreaterThan(0);
    const savedResolved = loaded.getPage(0).node.Annots()?.lookup(2, PDFDict);
    const resolvedAppearanceRef = savedResolved?.lookup(PDFName.of('AP'), PDFDict)?.get(PDFName.of('N'));
    expect(loaded.context.lookupMaybe(resolvedAppearanceRef, PDFStream)?.getContentsSize()).toBeGreaterThan(0);
  });
});
