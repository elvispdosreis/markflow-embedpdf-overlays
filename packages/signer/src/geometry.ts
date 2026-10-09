export type QuarterTurn = 0 | 1 | 2 | 3;
export interface BoxRect {origin: {x: number; y: number}; size: {width: number; height: number}}
export interface SignaturePage {index: number; size: BoxRect['size']; rotation: QuarterTurn; viewRotation?: QuarterTurn}
export interface SignatureInitialPosition {
  /** Distance from the box's right edge to the page's right edge, in PDF points. */
  x: number;
  /** Distance from the box's bottom edge to the page's bottom edge, in PDF points. */
  y: number;
  /** Zero-based destination page, default 0. */
  pageIndex?: number;
}
/** Bottom-right margins in the intrinsically rotated page, independent of temporary viewer rotation. */
export function signatureRectFromBottomRight(position: SignatureInitialPosition, size: BoxRect['size'], page: SignaturePage): BoxRect | null {
  if (!validPage(page) || ![position.x, position.y].every(n => Number.isFinite(n) && n >= 0)
    || ![size.width, size.height].every(n => Number.isFinite(n) && n > 0)) return null;
  const bounds = rotatedSize(page.size, page.rotation);
  const rect = {origin: {x: bounds.width - position.x - size.width, y: bounds.height - position.y - size.height}, size};
  if (!validRect(rect, bounds)) return null;
  return restoreRect(rect, page.size, page.rotation);
}
/** Same rounded contract as StampCoordinates. All dimensions are PDF points, not pixels. */
export interface SignatureCoordinates {
  margin: {right: number; bottom: number};
  image: {width: number; height: number};
  page: {number: number; width: number; height: number; rotation: number};
}
export function validPage(page: SignaturePage): boolean {
  return Number.isInteger(page.index) && page.index >= 0
    && [page.size.width, page.size.height].every(n => Number.isFinite(n) && n > 0)
    && [0, 1, 2, 3].includes(page.rotation)
    && [0, 1, 2, 3].includes(page.viewRotation ?? 0);
}
export function validRect(rect: BoxRect, size: BoxRect['size']): boolean {
  const {x, y} = rect.origin, {width, height} = rect.size;
  return [x, y, width, height].every(Number.isFinite) && x >= 0 && y >= 0 && width > 0 && height > 0
    && x + width <= size.width + 1e-8 && y + height <= size.height + 1e-8;
}
export function rotatedSize(size: BoxRect['size'], rotation: QuarterTurn): BoxRect['size'] {
  return rotation % 2 ? {width: size.height, height: size.width} : {...size};
}
export function rotateRect(rect: BoxRect, size: BoxRect['size'], rotation: QuarterTurn): BoxRect {
  const {x, y} = rect.origin, {width: w, height: h} = rect.size;
  return {origin: {
    x: rotation === 1 ? size.height - y - h : rotation === 2 ? size.width - x - w : rotation === 3 ? y : x,
    y: rotation === 1 ? x : rotation === 2 ? size.height - y - h : rotation === 3 ? size.width - x - w : y
  }, size: rotatedSize(rect.size, rotation)};
}
export function restoreRect(rect: BoxRect, size: BoxRect['size'], rotation: QuarterTurn): BoxRect {
  return rotateRect(rect, rotatedSize(size, rotation), ((4 - rotation) % 4) as QuarterTurn);
}
export function signatureCoordinates(rect: BoxRect, page: SignaturePage): SignatureCoordinates | null {
  if (!validPage(page) || !validRect(rect, page.size)) return null;
  const visual = rotateRect(rect, page.size, page.rotation);
  const size = rotatedSize(page.size, page.rotation);
  return {
    margin: {right: Math.round(size.width - visual.origin.x - visual.size.width),
      bottom: Math.round(size.height - visual.origin.y - visual.size.height)},
    image: {width: Math.round(visual.size.width), height: Math.round(visual.size.height)},
    page: {number: page.index + 1, width: Math.round(size.width), height: Math.round(size.height), rotation: page.rotation * 90}
  };
}
