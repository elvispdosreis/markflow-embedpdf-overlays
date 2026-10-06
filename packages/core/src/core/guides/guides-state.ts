import type {Position, Size} from '@embedpdf/models';

export type GuideOrientation = 'horizontal' | 'vertical';
export interface Guide {
  readonly id: string;
  readonly pageIndex: number;
  readonly orientation: GuideOrientation;
  /** Unrotated EmbedPDF page coordinates (PDF points), never viewport pixels. */
  readonly position: number;
}
interface DocumentGuides {
  readonly guides: readonly Guide[];
  readonly guidesVisible: boolean;
  readonly guidesLocked: boolean;
  readonly selectedId: string | null;
}
const EMPTY: DocumentGuides = {guides: [], guidesVisible: true, guidesLocked: false, selectedId: null};

/** Viewer session state. Deliberately independent of annotation/history/export/backend APIs. */
export class GuidesState {
  private isEnabled = false;
  private readonly documents = new Map<string, DocumentGuides>();
  private readonly listeners = new Set<() => void>();
  enabled(): boolean {return this.isEnabled;}
  subscribe(listener: () => void): () => void {this.listeners.add(listener); return () => {this.listeners.delete(listener);};}
  destroy(): void {this.documents.clear(); this.isEnabled = false; this.listeners.clear();}
  private notify(): void {for (const listener of this.listeners) listener();}
  get(documentId: string): DocumentGuides { return this.documents.get(documentId) ?? EMPTY; }
  forPage(documentId: string, pageIndex: number): readonly Guide[] {
    return this.get(documentId).guides.filter(guide => guide.pageIndex === pageIndex);
  }
  positions(documentId: string, pageIndex: number, orientation: GuideOrientation): number[] {
    return this.forPage(documentId, pageIndex).filter(g => g.orientation === orientation).map(g => g.position);
  }
  setEnabled(enabled: boolean): void {if (this.isEnabled === enabled) return; this.isEnabled = enabled; this.notify();}
  add(documentId: string, pageIndex: number, orientation: GuideOrientation, point: Position, size: Size): Guide | null {
    const position = this.position(orientation, point, size);
    if (!Number.isFinite(position) || pageIndex < 0) return null;
    const guide: Guide = {id: crypto.randomUUID(), pageIndex, orientation, position};
    this.patch(documentId, {guides: [...this.get(documentId).guides, guide]});
    return guide;
  }
  move(documentId: string, id: string, point: Position, size: Size): void {
    const state = this.get(documentId);
    if (state.guidesLocked || !state.guidesVisible) return;
    const guide = state.guides.find(g => g.id === id);
    if (!guide || this.position(guide.orientation, point, size) === guide.position) return;
    this.patch(documentId, {guides: state.guides.map(g => {
      const position = this.position(g.orientation, point, size);
      return g.id === id && Number.isFinite(position) ? {...g, position} : g;
    })});
  }
  select(documentId: string, id: string | null): void {
    const state = this.get(documentId);
    this.patch(documentId, {selectedId: state.guidesVisible && !state.guidesLocked && state.guides.some(g => g.id === id) ? id : null});
  }
  removeSelected(documentId: string): boolean {
    const state = this.get(documentId);
    if (!state.selectedId || state.guidesLocked || !state.guidesVisible) return false;
    this.patch(documentId, {guides: state.guides.filter(g => g.id !== state.selectedId), selectedId: null});
    return true;
  }
  remove(documentId: string, id: string): boolean {
    const state = this.get(documentId);
    if (state.guidesLocked || !state.guides.some(guide => guide.id === id)) return false;
    this.patch(documentId, {guides: state.guides.filter(guide => guide.id !== id), selectedId: state.selectedId === id ? null : state.selectedId});
    return true;
  }
  setVisible(documentId: string, guidesVisible: boolean): void { this.patch(documentId, {guidesVisible, selectedId: null}); }
  setLocked(documentId: string, guidesLocked: boolean): void { this.patch(documentId, {guidesLocked, selectedId: null}); }
  clear(documentId: string): void { this.patch(documentId, {guides: [], selectedId: null}); }
  close(documentId: string): void {
    if (this.documents.delete(documentId)) this.notify();
  }
  private patch(documentId: string, patch: Partial<DocumentGuides>): void {
    const previous = this.get(documentId);
    if (Object.entries(patch).every(([key, value]) => previous[key as keyof DocumentGuides] === value)) return;
    this.documents.set(documentId, {...previous, ...patch});
    this.notify();
  }
  private position(orientation: GuideOrientation, point: Position, size: Size): number {
    return orientation === 'horizontal' ? Math.max(0, Math.min(size.height, point.y)) : Math.max(0, Math.min(size.width, point.x));
  }
}
