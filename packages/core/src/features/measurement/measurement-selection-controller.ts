import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import {PdfAnnotationSubtype, type PdfLineAnnoObject, type PdfPolylineAnnoObject} from '@embedpdf/models';
import {isMeasurementAnnotation} from './measurement-tools';
import {annotationCalibration} from './measurement-calibration';
import {distanceDetails, type DistanceMeasurementDetails} from './distance-measurement';
import {arcDetails, type ArcMeasurementDetails} from './arc-measurement';
import type {Calibration} from './measurement.models';

export interface MeasurementSelectionOptions {
  getAnnotation(): AnnotationCapability | undefined;
  getActiveDocumentId(): string | null | undefined;
  getCalibration(): Calibration;
  isDragging(): boolean;
  onDistance(details: DistanceMeasurementDetails | null): void;
  onArc(details: ArcMeasurementDetails | null): void;
  onArcHandles(): void;
  onDetailClear(): void;
  onStatus(message: string): void;
  onSidebarChange(): void;
}

/** Selection details and sidebar edit actions, independent of the renderer. */
export class MeasurementSelectionController {
  constructor(private readonly options: MeasurementSelectionOptions) {}
  private get annotationApi(): AnnotationCapability | undefined {return this.options.getAnnotation();}
  private get calibration(): Calibration {return this.options.getCalibration();}

  deleteAreaVertex(documentId: string, annotationId: string, index: number): void {
    if (!this.annotationApi || this.options.getActiveDocumentId() !== documentId) return;
    const scope = this.annotationApi.forDocument(documentId);
    const annotation = scope.getAnnotationById(annotationId)?.object;
    if (annotation?.type !== PdfAnnotationSubtype.POLYGON || !isMeasurementAnnotation(annotation, 'area')) return;
    if (annotation.vertices.length <= 3) {
      this.options.onStatus('A área precisa de pelo menos três vértices.');
      return;
    }
    if (index < 0 || index >= annotation.vertices.length) return;
    const vertices = annotation.vertices.filter((_, vertexIndex) => vertexIndex !== index);
    const patch = this.annotationApi.transformAnnotation(annotation, {type: 'vertex-edit', changes: {vertices}});
    scope.updateAnnotation(annotation.pageIndex, annotation.id, patch);
    this.options.onDetailClear();
    this.options.onStatus('Vértice excluído.');
    this.options.onSidebarChange();
  }

  deletePerimeterSegment(documentId: string, annotationId: string, index: number): void {
    if (!this.annotationApi || this.options.getActiveDocumentId() !== documentId) return;
    const scope = this.annotationApi.forDocument(documentId);
    const annotation = scope.getAnnotationById(annotationId)?.object;
    if (annotation?.type !== PdfAnnotationSubtype.POLYLINE || !isMeasurementAnnotation(annotation, 'perimeter')) return;
    if (index < 0 || index >= annotation.vertices.length - 1) return;
    if (annotation.vertices.length === 2) {
      scope.deleteAnnotation(annotation.pageIndex, annotation.id);
    } else {
      const removedVertex = index === 0 ? 0 : index + 1;
      const vertices = annotation.vertices.filter((_, vertexIndex) => vertexIndex !== removedVertex);
      const patch = this.annotationApi.transformAnnotation(annotation, {type: 'vertex-edit', changes: {vertices}});
      scope.updateAnnotation(annotation.pageIndex, annotation.id, patch);
    }
    this.options.onDetailClear();
    this.options.onStatus('Segmento excluído.');
    this.options.onSidebarChange();
  }

  deleteMeasurement(documentId: string, annotationId: string): void {
    if (!this.annotationApi || this.options.getActiveDocumentId() !== documentId) return;
    const scope = this.annotationApi.forDocument(documentId);
    const annotation = scope.getAnnotationById(annotationId)?.object;
    if (!annotation || !isMeasurementAnnotation(annotation)) return;
    this.options.onDetailClear();
    scope.deleteAnnotation(annotation.pageIndex, annotation.id);
    this.options.onStatus('Medição excluída.');
    this.options.onSidebarChange();
  }

  refreshSelectedDistance(): void {
    if (!this.options.isDragging()) {
      const selectedLine = this.getSelectedDistanceLine();

      const calibration = selectedLine ? annotationCalibration(selectedLine, this.calibration) : this.calibration;
      this.options.onDistance(selectedLine
        ? distanceDetails(
            selectedLine,
            calibration.linearFactor,
            calibration.unit,
            calibration.precision
          )
        : null);
    }
    this.refreshSelectedArc();
  }

  refreshSelectedArc(): void {
    const selectedArc = this.getSelectedArc();
    const calibration = selectedArc ? annotationCalibration(selectedArc, this.calibration) : this.calibration;
    this.options.onArc(selectedArc
      ? arcDetails(
          selectedArc,
          calibration.linearFactor,
          calibration.unit,
          calibration.precision
        )
      : null);
    this.options.onArcHandles();
  }

  getSelectedArc(): PdfPolylineAnnoObject | null {
    return this.annotationApi?.getSelectedAnnotations()
      .map(item => item.object)
      .find((annotation): annotation is PdfPolylineAnnoObject => (
        annotation.type === PdfAnnotationSubtype.POLYLINE
        && isMeasurementAnnotation(annotation, 'arc')
      )) ?? null;
  }

  getSelectedDistanceLine(): PdfLineAnnoObject | null {
    return this.annotationApi?.getSelectedAnnotations()
      .map(item => item.object)
      .find((annotation): annotation is PdfLineAnnoObject => (
        annotation.type === PdfAnnotationSubtype.LINE
        && isMeasurementAnnotation(annotation, 'distance')
      )) ?? null;
  }

}
