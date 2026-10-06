import type {DocumentManagerCapability, PdfAnnotationObject, Position, Rect} from '@embedpdf/snippet';

export type XfdfDocument = NonNullable<ReturnType<DocumentManagerCapability['getActiveDocument']>>;

/** Mirrors EmbedPDF's page/device conversion, including CAD CropBox offsets. */
export function convertXfdfCoordinates(
  annotation: PdfAnnotationObject,
  document: XfdfDocument,
  toPdf: boolean
): PdfAnnotationObject {
  const page = document.pages.find(page => page.index === annotation.pageIndex);
  if (!page) throw new Error(`Página ${annotation.pageIndex + 1} não existe no PDF aberto.`);
  const {width: w, height: h} = page.size;
  const ox = page.boxes?.crop.left ?? 0;
  const oy = page.boxes?.crop.bottom ?? 0;
  const rotation = document.normalizedRotation ? 0 : page.rotation;
  const point = (p: Position): Position => {
    if (toPdf) {
      const result = rotation === 1 ? {x: p.y, y: p.x}
        : rotation === 2 ? {x: w - p.x, y: p.y}
        : rotation === 3 ? {x: h - p.y, y: w - p.x}
        : {x: p.x, y: h - p.y};
      return {x: result.x + ox, y: result.y + oy};
    }
    const x = p.x - ox;
    const y = p.y - oy;
    return rotation === 1 ? {x: y, y: x}
      : rotation === 2 ? {x: w - x, y}
      : rotation === 3 ? {x: w - y, y: h - x}
      : {x, y: h - y};
  };
  const rect = (r: Rect): Rect => {
    const p1 = point(r.origin);
    const p2 = point({x: r.origin.x + r.size.width, y: r.origin.y + r.size.height});
    return {origin: {x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y)},
      size: {width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y)}};
  };
  const result = {...annotation, rect: rect(annotation.rect)};
  if (result.unrotatedRect) result.unrotatedRect = rect(result.unrotatedRect);
  if ('calloutLine' in result && result.calloutLine) result.calloutLine = result.calloutLine.map(point);
  if ('rectangleDifferences' in result && result.rectangleDifferences) {
    const rd = result.rectangleDifferences;
    // Transform the inset box too: flipping or rotating the page changes its edges.
    const textBox = rect({
      origin: {x: annotation.rect.origin.x + rd.left, y: annotation.rect.origin.y + (toPdf ? rd.top : rd.bottom)},
      size: {width: annotation.rect.size.width - rd.left - rd.right,
        height: annotation.rect.size.height - rd.top - rd.bottom}
    });
    const nearY = textBox.origin.y - result.rect.origin.y;
    const farY = result.rect.origin.y + result.rect.size.height - textBox.origin.y - textBox.size.height;
    result.rectangleDifferences = {
      left: textBox.origin.x - result.rect.origin.x,
      right: result.rect.origin.x + result.rect.size.width - textBox.origin.x - textBox.size.width,
      top: toPdf ? farY : nearY,
      bottom: toPdf ? nearY : farY
    };
  }
  if ('linePoints' in result) result.linePoints = {start: point(result.linePoints.start), end: point(result.linePoints.end)};
  if ('vertices' in result) result.vertices = result.vertices.map(point);
  if ('segmentRects' in result) result.segmentRects = result.segmentRects.map(rect);
  if ('inkList' in result) result.inkList = result.inkList.map(stroke => ({...stroke, points: stroke.points.map(point)}));
  const controls = result.custom?.['arcControlPoints'] as {start: Position; end: Position; through: Position} | undefined;
  if (controls) result.custom = {...result.custom, arcControlPoints: {
    start: point(controls.start), end: point(controls.end), through: point(controls.through)
  }};
  return result;
}
