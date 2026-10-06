import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import {PdfAnnotationSubtype, type PdfPolylineAnnoObject, type PdfPolygonAnnoObject} from '@embedpdf/models';
import {findViewerViewport, overlayGeometry} from '../crosshair/overlay-geometry';
import type {GuidesContext} from '../guides/guides-context';
export interface MeasurementDetailSelection {
  documentId: string; annotationId: string; pageIndex: number; kind: 'segment' | 'vertex'; index: number;
}
export interface MeasurementDetailDrawing {kind: 'segment' | 'vertex'; index: number; points: {x: number; y: number}[]}
export interface MeasurementHighlightOptions {
  getContext(): GuidesContext | null;
  getAnnotation(): AnnotationCapability | undefined;
  getHostBounds(): DOMRect;
  onDrawing(drawing: MeasurementDetailDrawing | null): void;
}
/** Projects selected vertices/segments and owns its pending drawing frame. */
export class MeasurementHighlightController {
  selection: MeasurementDetailSelection | null = null;
  private frame?: number;
  private destroyed = false;
  constructor(private readonly options: MeasurementHighlightOptions) {}
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.selection = null;
    this.options.onDrawing(null);
  }
  scheduleMeasurementDetailHighlight(): void {
    if (this.destroyed || this.frame !== undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.renderMeasurementDetailHighlight();
    });
  }
  renderMeasurementDetailHighlight(): void {
    const selection = this.selection;
    const context = this.options.getContext();
    const root = context?.viewer.shadowRoot;
    const viewport = root ? findViewerViewport(root) : null;
    const geometry = context && viewport ? overlayGeometry(context, viewport) : null;
    if (!selection || !context || !geometry || context.getDocument()?.id !== selection.documentId) {
      this.options.onDrawing(null);
      return;
    }
    const annotation = this.options.getAnnotation()?.forDocument(selection.documentId).getAnnotationById(selection.annotationId)?.object;
    if (!annotation || (selection.kind === 'segment' && annotation.type !== PdfAnnotationSubtype.POLYLINE)
      || (selection.kind === 'vertex' && annotation.type !== PdfAnnotationSubtype.POLYGON)) {
      this.options.onDrawing(null);
      return;
    }
    const vertices = (annotation as PdfPolylineAnnoObject | PdfPolygonAnnoObject).vertices;
    const selected = vertices[selection.index];
    const end = selection.kind === 'segment'
      ? vertices[selection.index + 1]
      : vertices[(selection.index + 1) % vertices.length];
    if (!selected || !end) {
      this.options.onDrawing(null);
      return;
    }
    const host = this.options.getHostBounds();
    const points = [selected, end].map(point => {
      const rect = context.getContentRect(selection.documentId, selection.pageIndex,
        {origin: point, size: {width: 0, height: 0}});
      return rect ? {x: geometry.originX + rect.origin.x * geometry.sx - host.left,
        y: geometry.originY + rect.origin.y * geometry.sy - host.top} : null;
    });
    if (points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      this.options.onDrawing(null);
      return;
    }
    this.options.onDrawing({kind: selection.kind, index: selection.index, points: points as {x: number; y: number}[]});
  }
}