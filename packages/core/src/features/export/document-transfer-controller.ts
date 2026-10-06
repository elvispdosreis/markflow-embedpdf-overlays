import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {ExportCapability} from '@embedpdf/snippet';
import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/models';
import {createXfdf, parseXfdf, type XfdfCalibration} from './xfdf-export';
import type {XfdfDocument} from './xfdf-coordinates';
import {addTechnicalCommentPinAppearances} from './technical-comment-pdf';
import {convertLegacyTechnicalComment, technicalCommentsFromAnnotations} from '../technical-comments/technical-comment.models';
export interface DocumentTransferOptions {
  getAnnotation(): AnnotationCapability | undefined;
  getExport(): ExportCapability | undefined;
  getActiveDocumentId(): string | null | undefined;
  getDocument(): XfdfDocument | null | undefined;
  getFileName(): string;
  getCalibration(): XfdfCalibration;
  isReady(): boolean;
  onStatus(message: string): void;
  onCalibration(calibration: XfdfCalibration): void;
  onImported(annotations: PdfAnnotationObject[]): void;
}
/** Local XFDF/PDF transfer; remote persistence and approval stamps belong to the host. */
export class DocumentTransferController {
  private destroyed = false;
  private readonly timers = new Set<number>();
  private readonly urls = new Set<string>();
  constructor(private readonly options: DocumentTransferOptions) {}
  destroy(): void {
    this.destroyed = true;
    this.timers.forEach(timer => window.clearTimeout(timer)); this.timers.clear();
    this.urls.forEach(url => URL.revokeObjectURL(url)); this.urls.clear();
  }
  private defer(action: () => void): void {
    if (this.destroyed) return;
    const timer = window.setTimeout(() => {this.timers.delete(timer); if (!this.destroyed) action();}, 0);
    this.timers.add(timer);
  }
  private releaseUrl(url: string): void {
    this.urls.add(url);
    this.defer(() => {URL.revokeObjectURL(url); this.urls.delete(url);});
  }
  private get annotationApi(): AnnotationCapability | undefined {return this.options.getAnnotation();}
  private get exportApi(): ExportCapability | undefined {return this.options.getExport();}
  async download(): Promise<void> {
    if (this.destroyed) return;
    const documentId = this.options.getActiveDocumentId();
    const fileName = this.options.getFileName();
    if (!documentId || !this.exportApi) return;
    try {
      const bytes = await this.exportMergedPdf(documentId);
      if (this.destroyed) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], {type: 'application/pdf'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      this.releaseUrl(url);
    } catch (error) {
      console.error('Falha ao exportar os comentários técnicos.', error);
      this.options.onStatus('Não foi possível exportar o PDF com os comentários.');
    }
  }
  exportXfdf(): void {
    if (this.destroyed || !this.annotationApi || !this.options.isReady()) {
      return;
    }

    try {
      const annotations = this.annotationApi.getAnnotations().map(item => item.object);
      const xfdf = createXfdf(annotations, {
        fileName: this.options.getFileName(),
        calibration: this.options.getCalibration()
      });
      const baseName = this.options.getFileName().replace(/\.pdf$/i, '') || 'anotacoes';
      this.downloadTextFile(xfdf, `${baseName}.xfdf`, 'application/vnd.adobe.xfdf+xml');
      this.options.onStatus(`XFDF exportado · ${annotations.length} anotações.`);
    } catch (error) {
      console.error(error);
      this.options.onStatus('Não foi possível exportar o arquivo XFDF.');
    }
  }
  async exportMergedPdf(documentId: string): Promise<Uint8Array> {
    if (!this.exportApi) throw new Error('Exportação de PDF indisponível.');
    const buffer = await this.exportApi.forDocument(documentId).saveAsCopy().toPromise();
    const annotations = this.annotationApi?.forDocument(documentId).getAnnotations().map(item => item.object) ?? [];
    const comments = technicalCommentsFromAnnotations(annotations);
    return comments.length ? addTechnicalCommentPinAppearances(buffer, comments) : new Uint8Array(buffer);
  }
  async importXfdf(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const api = this.annotationApi;
    const documentId = this.options.getActiveDocumentId();
    const pdfDocument = this.options.getDocument();
    if (this.destroyed || !file || !api || !documentId) {
      return;
    }

    try {
      const text = await file.text();
      if (this.destroyed || this.options.getActiveDocumentId() !== documentId) return;
      const imported = parseXfdf(text, {document: pdfDocument ?? undefined});
      const scope = api.forDocument(documentId);
      if (imported.calibration && imported.source === 'native') {
        this.options.onCalibration(imported.calibration);
      }

      const updates: PdfAnnotationObject[] = [];
      const annotations = imported.annotations.map(source => {
        const annotation = source.type === PdfAnnotationSubtype.FREETEXT
          ? convertLegacyTechnicalComment(source) ?? source : source;
        const existing = scope.getAnnotationById(annotation.id)?.object;
        if (!existing) {
          return annotation;
        }
        if (imported.source === 'apryse' && existing.pageIndex === annotation.pageIndex) {
          updates.push(annotation);
          return annotation;
        }
        return {...annotation, id: crypto.randomUUID(), custom: {...annotation.custom, sourceAnnotationId: annotation.id}} as PdfAnnotationObject;
      });
      const updatedIds = new Set(updates.map(annotation => annotation.id));
      scope.importAnnotations(annotations.filter(annotation => !updatedIds.has(annotation.id)).map(annotation => ({annotation})));
      for (const annotation of updates) scope.updateAnnotation(annotation.pageIndex, annotation.id, annotation);
      this.defer(() => {
        if (this.options.getActiveDocumentId() === documentId) this.options.onImported(annotations);
      });
      this.options.onStatus(`XFDF importado · ${annotations.length} anotações.`);
    } catch (error) {
      console.error(error);
      this.options.onStatus(error instanceof Error ? error.message : 'Não foi possível importar o arquivo XFDF.');
    } finally {
      input.value = '';
    }
  }
  private downloadTextFile(content: string, fileName: string, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([content], {type: mimeType}));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    this.releaseUrl(url);
  }
}
