import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {HistoryCapability} from '@embedpdf/plugin-history';
import type {PdfAnnotationObject} from '@embedpdf/models';
import {isMeasurementAnnotation} from './measurement-tools';

export interface MeasurementHistoryOptions {
  getAnnotation(): AnnotationCapability | undefined;
  getHistory(): HistoryCapability | undefined;
  onRestore(documentId: string, annotation: PdfAnnotationObject): void;
  onChange(): void;
}
interface DocumentHistory {
  known: Set<string>;
  undo: PdfAnnotationObject[][];
  redo: PdfAnnotationObject[][];
  replaying: boolean;
}

/** Creation history, separate from EmbedPDF's native edit history. */
export class MeasurementHistory {
  private readonly documents = new Map<string, DocumentHistory>();
  constructor(private readonly options: MeasurementHistoryOptions) {}

  canUndo(documentId: string): boolean {return Boolean(this.documents.get(documentId)?.undo.length);}
  canRedo(documentId: string): boolean {return Boolean(this.documents.get(documentId)?.redo.length);}
  markLoaded(documentId: string, ids: readonly string[]): void {
    const state = this.state(documentId); ids.forEach(id => state.known.add(id));
  }

  recordCreation(documentId: string, annotation: PdfAnnotationObject): void {
    const state = this.state(documentId), api = this.options.getAnnotation();
    if (!api || state.replaying || state.known.has(annotation.id) || !isMeasurementAnnotation(annotation)) return;
    const family = api.forDocument(documentId).getAnnotations().map(item => item.object)
      .filter(item => item.id === annotation.id || item.custom?.['measurementDecorationFor'] === annotation.id);
    if (!family.some(item => item.id === annotation.id)) return;
    const snapshot = structuredClone(family);
    this.purge(documentId, snapshot);
    state.known.add(annotation.id); state.undo.push(snapshot); state.redo = [];
  }

  undo(documentId: string): void {
    const state = this.documents.get(documentId), api = this.options.getAnnotation();
    const family = state?.undo.at(-1), source = family?.find(item => isMeasurementAnnotation(item));
    if (!state || !api || !family || !source || state.replaying) return;
    const scope = api.forDocument(documentId);
    state.replaying = true;
    try {
      const current = scope.getAnnotationById(source.id)?.object;
      if (current) scope.deleteAnnotation(current.pageIndex, current.id);
      this.purge(documentId, family);
      state.undo.pop(); state.redo.push(family);
    } finally {state.replaying = false;}
    this.options.onChange();
  }

  redo(documentId: string): void {
    const state = this.documents.get(documentId), api = this.options.getAnnotation();
    const family = state?.redo.at(-1), source = family?.find(item => isMeasurementAnnotation(item));
    if (!state || !api || !family || !source || state.replaying) return;
    state.replaying = true;
    try {
      api.forDocument(documentId).importAnnotations(structuredClone(family).map(annotation => ({annotation})));
      this.purge(documentId, family);
      state.redo.pop(); state.undo.push(family);
      this.options.onRestore(documentId, structuredClone(source));
    } finally {state.replaying = false;}
    this.options.onChange();
  }

  close(documentId: string): void {this.documents.delete(documentId);}
  clear(): void {this.documents.clear();}
  private state(documentId: string): DocumentHistory {
    let state = this.documents.get(documentId);
    if (!state) {state = {known: new Set(), undo: [], redo: [], replaying: false}; this.documents.set(documentId, state);}
    return state;
  }
  private purge(documentId: string, family: readonly PdfAnnotationObject[]): void {
    const ids = new Set(family.map(item => item.id));
    this.options.getHistory()?.forDocument(documentId).purgeByMetadata<{annotationIds?: string[]}>(
      metadata => Boolean(metadata?.annotationIds?.some(id => ids.has(id))), 'annotations');
  }
}
