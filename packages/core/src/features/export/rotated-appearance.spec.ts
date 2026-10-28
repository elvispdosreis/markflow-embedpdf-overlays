import {PdfAnnotationSubtype, PdfStandardFont, type PdfFreeTextAnnoObject} from '@embedpdf/models';
import {PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFString, decodePDFRawStream} from 'pdf-lib';
import {describe, expect, it} from 'vitest';
import {fixRotatedAppearances} from './rotated-appearance';

// Geometry copied from a callout exported by EmbedPDF on a page with /Rotate 270.
const callout = {
  Type: 'Annot', Subtype: 'FreeText', IT: 'FreeTextCallout', NM: PDFString.of('callout'),
  Rect: [1183.72778, 769.95349, 1365.58044, 1142.46509],
  EPDFUnrotatedRect: [1088.39832, 865.28296, 1460.90991, 1047.13562], EPDFRotate: 270,
  CL: [1089.39832, 866.28296, 1225.05713, 1027.13562, 1310.90991, 1027.13562],
  RD: [222.51163, 141.852707, 0, 0], LE: 'OpenArrow', BS: {S: 'S', W: 1},
  DA: PDFString.of('.89411765 .25882354 .20392157 rg /Helv 14 Tf'), Contents: PDFString.of('teste seta'), F: 4
};
const model = {
  id: 'callout', pageIndex: 0, type: PdfAnnotationSubtype.FREETEXT, intent: 'FreeTextCallout',
  rect: {origin: {x: 0, y: 0}, size: {width: 1, height: 1}}, contents: 'teste seta ação',
  strokeColor: '#E44234', strokeWidth: 1, color: '#FFFFFF', fontColor: '#25D2D1', fontSize: 14,
  fontFamily: PdfStandardFont.Helvetica, textAlign: 0, verticalAlign: 0, opacity: 1
} as unknown as PdfFreeTextAnnoObject;

async function pdfWith(...annotations: Record<string, unknown>[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([1701, 4156]);
  page.node.set(PDFName.of('Rotate'), PDFNumber.of(270));
  for (const annotation of annotations) page.node.addAnnot(pdf.context.register(pdf.context.obj(annotation as never)));
  return pdf.save();
}

async function appearances(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPage(0).node.Annots()!.asArray().map(ref => {
    const annotation = pdf.context.lookup(ref, PDFDict);
    const stream = pdf.context.lookup(annotation.lookup(PDFName.of('AP'), PDFDict).get(PDFName.of('N'))) as PDFRawStream;
    const numbers = (key: string) => stream.dict.lookupMaybe(PDFName.of(key), PDFArray)?.asArray().map(item => (item as PDFNumber).asNumber());
    return {annotation, bbox: numbers('BBox'), matrix: numbers('Matrix'), content: new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())};
  });
}

const segments = (content: string) => [...content.matchAll(/(-?[\d.]+) (-?[\d.]+) m (-?[\d.]+) (-?[\d.]+) l S/g)]
  .map(match => match.slice(1, 5).map(Number));

describe('rotated appearances in the exported PDF', () => {
  it('draws the callout in its unrotated frame and turns it with the appearance matrix', async () => {
    const [{bbox, matrix, content}] = await appearances(await fixRotatedAppearances(await pdfWith(callout), [model]));
    expect(bbox).toEqual(callout.EPDFUnrotatedRect);
    // 270° about the frame center (1274.65, 956.21): its rotated bounding box is the annotation /Rect.
    expect(matrix?.slice(0, 4)).toEqual([0, -1, 1, 0]);
    expect(matrix?.[4]).toBeCloseTo(318.44, 1);
    expect(matrix?.[5]).toBeCloseTo(2230.86, 1);
    expect(content).toContain('1089.39832 866.28296 m 1225.05713 1027.13562 l 1310.90991 1027.13562 l S');
    // The text box sits where the leader line ends: x 1310.9–1460.9, y 1007.1–1047.1.
    const box = /([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re B/.exec(content)!.slice(1).map(Number);
    [1311.41, 1007.64, 149, 39].forEach((value, index) => expect(box[index]).toBeCloseTo(value, 1));
    // White fill, model text color, Helvetica 14 and WinAnsi accents (ç = E7, ã = E3).
    expect(content).toContain('1 1 1 rg');
    expect(content).toMatch(/0\.145098 0\.823529 0\.819608 rg\n\/F1 14 Tf\n1 0 0 1 1313\.9\d* [\d.]+ Tm\n<[0-9A-F]+61E7E36F> Tj/);
  });

  it('keeps the bounding box of the rotated frame equal to /Rect', async () => {
    const [{bbox, matrix}] = await appearances(await fixRotatedAppearances(await pdfWith(callout), [model]));
    const [a, b, c, d, e, f] = matrix!;
    const [x1, y1, x2, y2] = bbox!;
    const corners = [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(value => Math.round(value)))
      .toEqual(callout.Rect.map(value => Math.round(value)));
  });

  it('draws text markup lines along the reading direction of a page rotated 270°', async () => {
    const quad = [672, 496, 686, 496, 672, 423, 686, 423];
    const markup = (Subtype: string) => ({Type: 'Annot', Subtype, Rect: [672, 423, 686, 496], QuadPoints: quad, C: [1, 0, 0], F: 4});
    const [strike, underline, squiggly] = await appearances(
      await fixRotatedAppearances(await pdfWith(markup('StrikeOut'), markup('Underline'), markup('Squiggly')), []));
    expect(segments(strike.content)).toEqual([[679, 423, 679, 496]]);
    // On screen the text bottom is the lowest x of the quad.
    expect(segments(underline.content)).toEqual([[673.12, 423, 673.12, 496]]);
    const xs = [...squiggly.content.matchAll(/(-?[\d.]+) (-?[\d.]+) [ml]\b/g)].map(match => Number(match[1]));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(672);
    expect(Math.max(...xs)).toBeLessThan(675);
    expect(squiggly.bbox).toEqual([672, 423, 686, 496]);
  });

  it('leaves markups on unrotated pages and plain FreeText untouched', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]);
    page.node.addAnnot(pdf.context.register(pdf.context.obj({Type: 'Annot', Subtype: 'StrikeOut', Rect: [0, 0, 10, 10], QuadPoints: [0, 10, 10, 10, 0, 0, 10, 0]})));
    page.node.addAnnot(pdf.context.register(pdf.context.obj({Type: 'Annot', Subtype: 'FreeText', Rect: [0, 0, 10, 10], EPDFRotate: 90})));
    const loaded = await PDFDocument.load(await fixRotatedAppearances(await pdf.save(), []));
    for (const ref of loaded.getPage(0).node.Annots()!.asArray()) {
      expect(loaded.context.lookup(ref, PDFDict).has(PDFName.of('AP'))).toBe(false);
    }
  });
});
