import {PdfAnnotationSubtype, PdfStandardFont, type PdfAnnotationObject, type PdfFreeTextAnnoObject} from '@embedpdf/models';
import {
  PDFArray, PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFNumber, PDFString, StandardFonts
} from 'pdf-lib';

/** Rebuild the normal appearance (/AP /N) of annotations whose engine-generated
 * appearance is wrong on rotated pages:
 * - FreeText callouts: drawn in the unrotated frame (/EPDFUnrotatedRect) and rotated with the AP /Matrix;
 * - StrikeOut, Underline and Squiggly: lines follow the reading direction of the rotated page.
 * Every other annotation is left untouched.
 */
export async function fixRotatedAppearances(
  input: ArrayBuffer | Uint8Array,
  annotations: readonly PdfAnnotationObject[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input, {updateMetadata: false});
  const byId = new Map(annotations.map(annotation => [annotation.id, annotation]));
  const fonts = new Map<StandardFonts, PDFFont>();
  const font = async (name: StandardFonts) => {
    if (!fonts.has(name)) fonts.set(name, await pdf.embedFont(name));
    return fonts.get(name)!;
  };

  for (const page of pdf.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    const pageRotation = normalizeAngle(page.getRotation().angle);
    for (let index = 0; index < annots.size(); index++) {
      const annotation = pdf.context.lookupMaybe(annots.get(index), PDFDict);
      if (!annotation) continue;
      const subtype = nameOf(annotation, 'Subtype');
      if (subtype === 'FreeText' && nameOf(annotation, 'IT') === 'FreeTextCallout') {
        const model = byId.get(textOf(annotation, 'NM') ?? '') as PdfFreeTextAnnoObject | undefined;
        if (model && model.type !== PdfAnnotationSubtype.FREETEXT) continue;
        await rebuildRotatedCallout(pdf, annotation, model, font);
      } else if (pageRotation && (subtype === 'StrikeOut' || subtype === 'Underline' || subtype === 'Squiggly')) {
        rebuildRotatedTextMarkup(pdf, annotation, subtype, pageRotation);
      }
    }
  }
  return pdf.save();
}

const TEXT_MARKUPS = new Set([PdfAnnotationSubtype.STRIKEOUT, PdfAnnotationSubtype.UNDERLINE, PdfAnnotationSubtype.SQUIGGLY]);

/** Whether the exported PDF may hold an appearance that {@link fixRotatedAppearances} rebuilds. */
export function needsRotatedAppearance(annotation: PdfAnnotationObject): boolean {
  if (TEXT_MARKUPS.has(annotation.type)) return true;
  return annotation.type === PdfAnnotationSubtype.FREETEXT && annotation.intent === 'FreeTextCallout'
    && normalizeAngle(annotation.rotation ?? 0) !== 0;
}

type Point = {x: number; y: number};
type Box = {x1: number; y1: number; x2: number; y2: number};

async function rebuildRotatedCallout(
  pdf: PDFDocument,
  annotation: PDFDict,
  model: PdfFreeTextAnnoObject | undefined,
  font: (name: StandardFonts) => Promise<PDFFont>
): Promise<void> {
  const rotation = normalizeAngle(numberOf(annotation, 'EPDFRotate') ?? 0);
  const frame = boxOf(annotation, 'EPDFUnrotatedRect');
  if (!rotation || !frame) return;
  const line = numbersOf(annotation, 'CL');
  const points: Point[] = [];
  for (let index = 0; line && index + 1 < line.length; index += 2) points.push({x: line[index], y: line[index + 1]});
  const box = textBox(frame, numbersOf(annotation, 'RD'), points.at(-1));
  if (box.x2 - box.x1 <= 0 || box.y2 - box.y1 <= 0) return;

  const appearance = parseAppearance(textOf(annotation, 'DA') ?? '');
  const strokeWidth = model?.strokeWidth ?? numberOf(annotation.lookupMaybe(PDFName.of('BS'), PDFDict), 'W') ?? 1;
  const stroke = rgb(model?.strokeColor) ?? (model ? undefined : appearance.color);
  const fill = model ? rgb(model.color) : colorArray(annotation, 'C');
  const textColor = rgb(model?.fontColor) ?? appearance.color ?? [0, 0, 0];
  const fontSize = model?.fontSize ?? appearance.size ?? 12;
  const textFont = await font(standardFont(model?.fontFamily));
  const textAlign = model?.textAlign ?? numberOf(annotation, 'Q') ?? 0;
  const verticalAlign = model?.verticalAlign ?? numberOf(annotation, 'EPDF:VerticalAlignment') ?? 0;
  const opacity = model?.opacity ?? numberOf(annotation, 'CA') ?? 1;
  const ending = nameOf(annotation, 'LE') ?? 'None';

  const commands = ['/GS gs', '1 j'];
  if (stroke && strokeWidth > 0) {
    commands.push(`${color(stroke)} RG`, `${color(stroke)} rg`, `${fmt(strokeWidth)} w`);
    if (points.length >= 2) {
      commands.push(points.map((point, index) => `${fmt(point.x)} ${fmt(point.y)} ${index ? 'l' : 'm'}`).join(' ') + ' S');
      commands.push(...lineEnding(ending, points[0], points[1], strokeWidth));
    }
  }
  const half = stroke && strokeWidth > 0 ? strokeWidth / 2 : 0;
  const rect = `${fmt(box.x1 + half)} ${fmt(box.y1 + half)} ${fmt(box.x2 - box.x1 - 2 * half)} ${fmt(box.y2 - box.y1 - 2 * half)} re`;
  if (fill) commands.push(`${color(fill)} rg`);
  if (fill && half) commands.push(rect + ' B');
  else if (fill) commands.push(rect + ' f');
  else if (half) commands.push(rect + ' S');

  const padding = 2 * half + 2;
  const area = {x1: box.x1 + padding, y1: box.y1 + padding, x2: box.x2 - padding, y2: box.y2 - padding};
  const text = (model?.contents ?? textOf(annotation, 'Contents') ?? '').trim();
  if (text && area.x2 > area.x1 && area.y2 > area.y1) {
    const lineHeight = fontSize * 1.169;
    const lines = wrapText(text, textFont, fontSize, area.x2 - area.x1);
    const blockHeight = lines.length * lineHeight;
    const free = area.y2 - area.y1 - blockHeight;
    const top = area.y2 - (verticalAlign === 1 ? free / 2 : verticalAlign === 2 ? free : 0);
    commands.push('q', `${fmt(area.x1)} ${fmt(area.y1)} ${fmt(area.x2 - area.x1)} ${fmt(area.y2 - area.y1)} re W n`,
      'BT', `${color(textColor)} rg`, `/F1 ${fmt(fontSize)} Tf`);
    lines.forEach((value, index) => {
      const width = textFont.widthOfTextAtSize(value, fontSize);
      const space = area.x2 - area.x1 - width;
      const x = area.x1 + (textAlign === 1 ? space / 2 : textAlign === 2 ? space : 0);
      const baseline = top - lineHeight * index - fontSize * .945;
      commands.push(`1 0 0 1 ${fmt(x)} ${fmt(baseline)} Tm`, `${textFont.encodeText(value)} Tj`);
    });
    commands.push('ET', 'Q');
  }

  const radians = rotation * Math.PI / 180;
  const cos = round(Math.cos(radians));
  const sin = round(Math.sin(radians));
  const cx = (frame.x1 + frame.x2) / 2;
  const cy = (frame.y1 + frame.y2) / 2;
  const matrix = [cos, sin, -sin, cos, cx - (cos * cx - sin * cy), cy - (sin * cx + cos * cy)].map(round);
  const stream = pdf.context.flateStream(commands.join('\n'), {
    Type: 'XObject', Subtype: 'Form', FormType: 1,
    BBox: [frame.x1, frame.y1, frame.x2, frame.y2],
    Matrix: matrix,
    Resources: {
      Font: {F1: textFont.ref},
      ExtGState: {GS: {Type: 'ExtGState', CA: opacity, ca: opacity}}
    }
  });
  annotation.set(PDFName.of('AP'), pdf.context.obj({N: pdf.context.register(stream)}));
}

/** Text box inside the unrotated frame. EmbedPDF writes /RD as [left bottom right top]
 * and the PDF specification as [left top right bottom]; the leader line ends on the box,
 * so the reading that puts the last callout point on the box border wins. */
function textBox(frame: Box, rd: number[] | undefined, end: Point | undefined): Box {
  const [left = 0, second = 0, right = 0, fourth = 0] = rd ?? [];
  const embed = {x1: frame.x1 + left, y1: frame.y1 + second, x2: frame.x2 - right, y2: frame.y2 - fourth};
  const spec = {x1: frame.x1 + left, y1: frame.y1 + fourth, x2: frame.x2 - right, y2: frame.y2 - second};
  if (!end || second === fourth) return embed;
  return borderDistance(spec, end) < borderDistance(embed, end) ? spec : embed;
}

function borderDistance(box: Box, point: Point): number {
  const dx = Math.max(box.x1 - point.x, 0, point.x - box.x2);
  const dy = Math.max(box.y1 - point.y, 0, point.y - box.y2);
  const outside = Math.hypot(dx, dy);
  if (outside > 0) return outside;
  return Math.min(point.x - box.x1, box.x2 - point.x, point.y - box.y1, box.y2 - point.y);
}

function lineEnding(name: string, tip: Point, from: Point, width: number): string[] {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const size = Math.max(9, width * 6);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = (along: number, across: number) =>
    `${fmt(tip.x + along * cos - across * sin)} ${fmt(tip.y + along * sin + across * cos)}`;
  const wing = size * Math.cos(Math.PI / 6);
  const spread = size * Math.sin(Math.PI / 6);
  switch (name) {
    case 'OpenArrow': return [`${at(-wing, spread)} m ${at(0, 0)} l ${at(-wing, -spread)} l S`];
    case 'ClosedArrow': return [`${at(-wing, spread)} m ${at(0, 0)} l ${at(-wing, -spread)} l h B`];
    case 'Butt': return [`${at(0, spread)} m ${at(0, -spread)} l S`];
    case 'Square': return [`${at(-spread, spread)} m ${at(spread, spread)} l ${at(spread, -spread)} l ${at(-spread, -spread)} l h B`];
    case 'Diamond': return [`${at(-spread, 0)} m ${at(0, spread)} l ${at(spread, 0)} l ${at(0, -spread)} l h B`];
    case 'Circle': {
      const r = spread;
      const k = r * .5523;
      const {x, y} = tip;
      return [[
        `${fmt(x + r)} ${fmt(y)} m`,
        `${fmt(x + r)} ${fmt(y + k)} ${fmt(x + k)} ${fmt(y + r)} ${fmt(x)} ${fmt(y + r)} c`,
        `${fmt(x - k)} ${fmt(y + r)} ${fmt(x - r)} ${fmt(y + k)} ${fmt(x - r)} ${fmt(y)} c`,
        `${fmt(x - r)} ${fmt(y - k)} ${fmt(x - k)} ${fmt(y - r)} ${fmt(x)} ${fmt(y - r)} c`,
        `${fmt(x + k)} ${fmt(y - r)} ${fmt(x + r)} ${fmt(y - k)} ${fmt(x + r)} ${fmt(y)} c h B`
      ].join(' ')];
    }
    default: return [];
  }
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  const fits = (value: string) => font.widthOfTextAtSize(value, size) <= width;
  for (const paragraph of encodable(text, font).split(/\r\n|\r|\n/)) {
    let current = '';
    for (const word of paragraph.split(/(?<=\s)/)) {
      if (fits(current + word.trimEnd())) {
        current += word;
        continue;
      }
      if (current.trim()) lines.push(current.trimEnd());
      current = '';
      // Break words wider than the box character by character.
      for (const char of word) {
        if (current && !fits(current + char)) {
          lines.push(current);
          current = '';
        }
        current += char;
      }
    }
    lines.push(current.trimEnd());
  }
  return lines;
}

function encodable(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return [...text].map(char => /\s/.test(char) || supported.has(char.codePointAt(0)!) ? char : '?').join('');
}

/** Lines of strike-out, underline and squiggly follow the reading direction of the
 * rotated page. Each quad is an axis-aligned box around a run of text. */
function rebuildRotatedTextMarkup(
  pdf: PDFDocument, annotation: PDFDict, subtype: string, pageRotation: number
): void {
  const quads = numbersOf(annotation, 'QuadPoints');
  const rect = boxOf(annotation, 'Rect');
  if (!quads || quads.length < 8 || !rect || pageRotation % 90) return;
  const stroke = colorArray(annotation, 'C') ?? [0, 0, 0];
  const opacity = numberOf(annotation, 'CA') ?? 1;
  const commands = ['/GS gs', `${color(stroke)} RG`, '1 j', '1 J'];
  for (let index = 0; index + 7 < quads.length; index += 8) {
    const xs = [0, 2, 4, 6].map(offset => quads[index + offset]);
    const ys = [1, 3, 5, 7].map(offset => quads[index + offset]);
    const box = {x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys)};
    const vertical = pageRotation === 90 || pageRotation === 270;
    const thickness = vertical ? box.x2 - box.x1 : box.y2 - box.y1;
    const [start, end] = vertical ? [box.y1, box.y2] : [box.x1, box.x2];
    if (thickness <= 0 || end <= start) continue;
    // u = 0 is the top of the text on screen and u = 1 its bottom.
    const cross = (u: number) => pageRotation === 90 ? box.x1 + u * thickness
      : pageRotation === 270 ? box.x2 - u * thickness
        : pageRotation === 180 ? box.y1 + u * thickness
          : box.y2 - u * thickness;
    const point = (along: number, u: number) => vertical
      ? `${fmt(cross(u))} ${fmt(along)}` : `${fmt(along)} ${fmt(cross(u))}`;
    const width = Math.max(.5, thickness / 14);
    commands.push(`${fmt(width)} w`);
    if (subtype === 'StrikeOut') commands.push(`${point(start, .5)} m ${point(end, .5)} l S`);
    else if (subtype === 'Underline') commands.push(`${point(start, .92)} m ${point(end, .92)} l S`);
    else {
      const step = Math.max(1, thickness / 7);
      const path = [`${point(start, .97)} m`];
      for (let along = start + step, up = true; along < end + step; along += step, up = !up) {
        path.push(`${point(Math.min(along, end), up ? .97 - step / thickness : .97)} l`);
      }
      commands.push(path.join(' ') + ' S');
    }
  }
  const stream = pdf.context.flateStream(commands.join('\n'), {
    Type: 'XObject', Subtype: 'Form', FormType: 1,
    BBox: [rect.x1, rect.y1, rect.x2, rect.y2],
    Resources: {ExtGState: {GS: {Type: 'ExtGState', CA: opacity, ca: opacity}}}
  });
  annotation.set(PDFName.of('AP'), pdf.context.obj({N: pdf.context.register(stream)}));
}

const STANDARD_FONTS: Partial<Record<PdfStandardFont, StandardFonts>> = {
  [PdfStandardFont.Courier]: StandardFonts.Courier,
  [PdfStandardFont.Courier_Bold]: StandardFonts.CourierBold,
  [PdfStandardFont.Courier_BoldOblique]: StandardFonts.CourierBoldOblique,
  [PdfStandardFont.Courier_Oblique]: StandardFonts.CourierOblique,
  [PdfStandardFont.Helvetica_Bold]: StandardFonts.HelveticaBold,
  [PdfStandardFont.Helvetica_BoldOblique]: StandardFonts.HelveticaBoldOblique,
  [PdfStandardFont.Helvetica_Oblique]: StandardFonts.HelveticaOblique,
  [PdfStandardFont.Times_Roman]: StandardFonts.TimesRoman,
  [PdfStandardFont.Times_Bold]: StandardFonts.TimesRomanBold,
  [PdfStandardFont.Times_BoldItalic]: StandardFonts.TimesRomanBoldItalic,
  [PdfStandardFont.Times_Italic]: StandardFonts.TimesRomanItalic
};

function standardFont(family: PdfStandardFont | undefined): StandardFonts {
  return (family !== undefined && STANDARD_FONTS[family]) || StandardFonts.Helvetica;
}

function parseAppearance(value: string): {color?: [number, number, number]; size?: number} {
  const color = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+rg\b/.exec(value);
  const size = /\/[^\s/]+\s+(-?[\d.]+)\s+Tf\b/.exec(value);
  return {
    color: color ? [Number(color[1]), Number(color[2]), Number(color[3])] : undefined,
    size: size && Number(size[1]) > 0 ? Number(size[1]) : undefined
  };
}

function rgb(value: string | undefined): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{6})$/i.exec(value ?? '');
  if (!match) return undefined;
  return [0, 2, 4].map(index => Number.parseInt(match[1].slice(index, index + 2), 16) / 255) as [number, number, number];
}

function colorArray(dict: PDFDict, key: string): [number, number, number] | undefined {
  const values = numbersOf(dict, key);
  return values?.length === 3 ? values as [number, number, number] : undefined;
}

function nameOf(dict: PDFDict, key: string): string | undefined {
  return dict.lookupMaybe(PDFName.of(key), PDFName)?.decodeText();
}

function textOf(dict: PDFDict, key: string): string | undefined {
  return dict.lookupMaybe(PDFName.of(key), PDFString, PDFHexString)?.decodeText();
}

function numberOf(dict: PDFDict | undefined, key: string): number | undefined {
  const value = dict && dict.context.lookup(dict.get(PDFName.of(key)));
  const number = value instanceof PDFNumber ? value.asNumber()
    : value instanceof PDFString ? Number(value.decodeText())
      : value instanceof PDFName ? Number(value.decodeText()) : undefined;
  return number !== undefined && Number.isFinite(number) ? number : undefined;
}

function numbersOf(dict: PDFDict, key: string): number[] | undefined {
  const array = dict.lookupMaybe(PDFName.of(key), PDFArray);
  if (!array) return undefined;
  const values = array.asArray().map(item => dict.context.lookupMaybe(item, PDFNumber)?.asNumber());
  return values.every((value): value is number => value !== undefined) ? values : undefined;
}

function boxOf(dict: PDFDict, key: string): Box | undefined {
  const values = numbersOf(dict, key);
  if (values?.length !== 4) return undefined;
  const [a, b, c, d] = values;
  return {x1: Math.min(a, c), y1: Math.min(b, d), x2: Math.max(a, c), y2: Math.max(b, d)};
}

function normalizeAngle(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360;
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6 || 0;
}

function color(value: readonly number[]): string {
  return value.map(fmt).join(' ');
}

function fmt(value: number): string {
  return String(round(value));
}
