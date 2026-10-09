import {signatureCoordinates, validPage, validRect, type BoxRect, type SignatureCoordinates, type SignaturePage} from './geometry';
export interface SignatureSelection {
  documentId: string; pageIndex: number; rect: BoxRect;
  /** Clockwise quarter turns, including fractional turns (0.25 = 22.5 degrees). */
  rotation?: number;
  /** Actual signing box dimensions before its signature rotation; rect is its enclosing bounds. */
  signatureSize?: BoxRect['size'];
  /** Present only while the box occupies a named reserved signature field. */
  field?: {name: string; annotationId: string};
}
export interface SignatureRequest extends SignatureSelection {
  coordinates: SignatureCoordinates;
  /** Clockwise signature orientation in unrotated PDF space, in degrees. */
  signatureRotation: number;
  /** Unrotated bottom-left PDF rectangle, full precision, for signing services. */
  pdfRect: {x: number; y: number; width: number; height: number};
}
export interface SignerContext {
  getPage(documentId: string, pageIndex: number): SignaturePage | null;
  subscribe(listener: () => void): () => void;
  onDocumentClosed?(listener: (documentId: string) => void): () => void;
}
const copy = (value: SignatureSelection): SignatureSelection => ({...value,
  ...(value.field ? {field: {...value.field}} : {}),
  ...(value.signatureSize ? {signatureSize: {...value.signatureSize}} : {}),
  rect: {origin: {...value.rect.origin}, size: {...value.rect.size}}});
/** One movable signature location per viewer session, shared by all page mounts. */
export class SignerState {
  private selection: SignatureSelection | null = null;
  private active = true;
  private initialized = new Set<string>();
  private listeners = new Set<() => void>();
  enabled(): boolean {return this.active;}
  setEnabled(enabled: boolean): void {if (enabled !== this.active) {this.active = enabled; this.notify();}}
  getSelection(): SignatureSelection | null {return this.selection ? copy(this.selection) : null;}
  select(documentId: string, page: SignaturePage, rect: BoxRect, rotation?: number, signatureSize?: BoxRect['size'], field?: SignatureSelection['field']): boolean {
    const angle = rotation ?? (this.selection?.documentId === documentId ? this.selection.rotation ?? 0 : 0);
    if (!documentId || !validPage(page) || !validRect(rect, page.size) || !Number.isFinite(angle) || angle < 0 || angle >= 4) return false;
    const dimensions = signatureSize ?? (this.selection?.documentId === documentId ? this.selection.signatureSize : undefined)
      ?? (angle % 2 === 1 ? {width: rect.size.height, height: rect.size.width} : rect.size);
    if (![dimensions.width, dimensions.height].every(n => Number.isFinite(n) && n > 0)) return false;
    this.initialized.add(documentId);
    this.selection = copy({documentId, pageIndex: page.index, rect, rotation: angle, signatureSize: dimensions,
      ...(field ? {field} : {})}); this.notify(); return true;
  }
  clear(documentId?: string): void {
    if (!this.selection || (documentId !== undefined && documentId !== this.selection.documentId)) return;
    this.selection = null; this.notify();
  }
  subscribe(listener: () => void): () => void {this.listeners.add(listener); return () => this.listeners.delete(listener);}
  initialize(documentId: string, page: SignaturePage, rect: BoxRect, rotation?: number): void {
    if (!this.initialized.has(documentId)) this.select(documentId, page, rect, rotation);
  }
  /** Rotate the signature itself by 22.5 degrees; page/viewer rotation is unchanged. */
  rotate(context: SignerContext, direction: 1 | -1 = 1): boolean {
    if (![1, -1].includes(direction)) return false;
    return this.setRotation(context, ((this.selection?.rotation ?? 0) + direction / 4) * 90);
  }
  /** Set an absolute signature angle, snapped to 22.5-degree increments. */
  setRotation(context: SignerContext, degrees: number): boolean {
    const selection = this.getSelection();
    if (!selection || !this.active || !Number.isFinite(degrees)) return false;
    const page = context.getPage(selection.documentId, selection.pageIndex);
    if (!page || !validPage(page)) return false;
    const angle = ((Math.round(degrees / 22.5) * 22.5 % 360) + 360) % 360;
    const radians = angle * Math.PI / 180;
    const clean = (value: number) => Math.abs(value) < 1e-12 ? 0 : Math.abs(value);
    const c = clean(Math.cos(radians)), s = clean(Math.sin(radians));
    const dimensions = selection.signatureSize!;
    const {origin, size} = selection.rect, nextSize = {
      width: dimensions.width * c + dimensions.height * s,
      height: dimensions.width * s + dimensions.height * c};
    if (nextSize.width > page.size.width || nextSize.height > page.size.height) return false;
    const next = {size: nextSize, origin: {
      x: Math.max(0, Math.min(origin.x + (size.width - nextSize.width) / 2, page.size.width - nextSize.width)),
      y: Math.max(0, Math.min(origin.y + (size.height - nextSize.height) / 2, page.size.height - nextSize.height))
    }};
    return this.select(selection.documentId, page, next, angle / 90, dimensions);
  }
  close(documentId: string): void {this.initialized.delete(documentId); this.clear(documentId);}
  /** Call only from the application's explicit Sign button. No PDF is modified here. */
  confirm(context: SignerContext): SignatureRequest | null {
    const selection = this.getSelection();
    if (!selection || !this.active) return null;
    const page = context.getPage(selection.documentId, selection.pageIndex);
    const coordinates = page ? signatureCoordinates(selection.rect, page) : null;
    if (!page || !coordinates) return null;
    const {origin, size} = selection.rect;
    return {...selection, signatureRotation: (selection.rotation ?? 0) * 90,
      coordinates, pdfRect: {x: origin.x, y: page.size.height - origin.y - size.height, ...size}};
  }
  destroy(): void {this.selection = null; this.active = false; this.initialized.clear(); this.listeners.clear();}
  private notify(): void {for (const listener of this.listeners) listener();}
}
