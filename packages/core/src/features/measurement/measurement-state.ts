import type {MeasurementRecord} from './measurement.models';

/** Document-scoped results. The host adapts changes to its own UI state mechanism. */
export class MeasurementState {
  private readonly documents = new Map<string, MeasurementRecord[]>();
  private activeDocumentId: string | null = null;
  constructor(private readonly onChange: (items: MeasurementRecord[]) => void, private readonly limit = 20) {}

  activate(documentId: string | null): void {
    if (documentId === this.activeDocumentId) return;
    this.activeDocumentId = documentId;
    this.publish();
  }

  get(documentId: string): MeasurementRecord[] {
    return (this.documents.get(documentId) ?? []).map(item => ({...item}));
  }

  replace(documentId: string, items: readonly MeasurementRecord[]): void {
    const distinct = new Map<string, MeasurementRecord>();
    for (const item of items) if (!distinct.has(item.annotationId)) distinct.set(item.annotationId, {...item});
    this.documents.set(documentId, [...distinct.values()].slice(0, this.limit));
    if (documentId === this.activeDocumentId) this.publish();
  }

  update(documentId: string, update: (items: MeasurementRecord[]) => MeasurementRecord[]): void {
    this.replace(documentId, update(this.get(documentId)));
  }

  upsert(documentId: string, item: MeasurementRecord): void {
    this.update(documentId, items => [item, ...items.filter(current => current.annotationId !== item.annotationId)]);
  }

  remove(documentId: string, annotationId: string): void {
    this.update(documentId, items => items.filter(item => item.annotationId !== annotationId));
  }

  close(documentId: string): void {
    this.documents.delete(documentId);
    if (this.activeDocumentId === documentId) {this.activeDocumentId = null; this.publish();}
  }

  clear(): void {this.documents.clear(); this.activeDocumentId = null; this.publish();}
  private publish(): void {this.onChange(this.activeDocumentId ? this.get(this.activeDocumentId) : []);}
}
