import {PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString, StandardFonts} from 'pdf-lib';
import type {TechnicalComment} from '../technical-comments/technical-comment.models';

/** Add the numbered pin to the native sticky note's normal appearance.
 * The /Text annotation and its /Contents remain intact, so PDF readers can open the comment.
 */
export async function addTechnicalCommentPinAppearances(
  input: ArrayBuffer | Uint8Array,
  comments: readonly TechnicalComment[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input, {updateMetadata: false});
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const byPage = new Map<number, {byNumber: Map<number, TechnicalComment>; byId: Map<string, TechnicalComment>}>();
  for (const comment of comments) {
    const index = byPage.get(comment.pageIndex) ?? {byNumber: new Map(), byId: new Map()};
    index.byNumber.set(comment.number, comment);
    index.byId.set(comment.id, comment);
    byPage.set(comment.pageIndex, index);
  }

  for (const [pageIndex, page] of pdf.getPages().entries()) {
    const pageComments = byPage.get(pageIndex);
    const annotations = page.node.Annots();
    if (!pageComments || !annotations) continue;
    for (let index = 0; index < annotations.size(); index++) {
      const annotation = pdf.context.lookupMaybe(annotations.get(index), PDFDict);
      if (!annotation || annotation.lookupMaybe(PDFName.of('Subtype'), PDFName)?.toString() !== '/Text') continue;
      const subject = annotation.lookupMaybe(PDFName.of('Subj'), PDFString, PDFHexString)?.decodeText();
      const match = /^MarkFlowComment:(error|note|question|resolved):([1-9]\d*)$/.exec(subject ?? '');
      const nativeId = annotation.lookupMaybe(PDFName.of('NM'), PDFString, PDFHexString)?.decodeText();
      const comment = (nativeId ? pageComments.byId.get(nativeId) : undefined)
        ?? (match ? pageComments.byNumber.get(Number(match[2])) : undefined);
      if (!comment || (match && comment.kind !== match[1])) continue;
      const rect = annotation.lookupMaybe(PDFName.of('Rect'), PDFArray);
      if (!rect) continue;
      const {width, height} = rect.asRectangle();
      if (width <= 0 || height <= 0) continue;

      const [r, g, b] = colorChannels(comment.color);
      const size = width * (comment.number >= 100 ? .315 : comment.number >= 10 ? .375 : .42);
      const label = String(comment.number);
      const textX = (width - font.widthOfTextAtSize(label, size)) / 2;
      const textY = height * .39;
      // The first transform maps the pin.svg's 200-unit, top-left coordinate system to PDF points.
      const commands = [
        'q',
        `${width / 200} 0 0 ${-height / 200} 0 ${height} cm`,
        `${r} ${g} ${b} rg`, '1 1 1 RG', '5 w', '1 j',
        '12 12 m 105 12 l 153 12 188 49 188 100 c 188 151 151 188 100 188 c 49 188 12 151 12 100 c h B',
        'Q',
        'q', '1 1 1 rg', 'BT', `/F1 ${size} Tf`,
        `1 0 0 1 ${textX} ${textY} Tm`, `${font.encodeText(label)} Tj`, 'ET', 'Q'
      ].join('\n');
      const appearance = pdf.context.flateStream(commands, {
        Type: 'XObject', Subtype: 'Form', FormType: 1,
        BBox: [0, 0, width, height],
        Resources: {Font: {F1: font.ref}}
      });
      const appearanceRef = pdf.context.register(appearance);
      annotation.set(PDFName.of('AP'), pdf.context.obj({N: appearanceRef}));
    }
  }
  return pdf.save();
}

function colorChannels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return [0, .4, .65];
  const value = match[1];
  return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16) / 255) as [number, number, number];
}
