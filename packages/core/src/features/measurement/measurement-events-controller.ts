import type {AnnotationEvent} from '@embedpdf/plugin-annotation';
import {PdfAnnotationSubtype, type PdfAnnotationObject, type PdfLineAnnoObject, type PdfPolylineAnnoObject} from '@embedpdf/models';
import {isMeasurementAnnotation} from './measurement-tools';
import {isDistanceDecoration} from './distance-measurement';
import {isShapeMeasurementAnnotation} from './shape-measurement-label';
import {isPerimeterMeasurementAnnotation} from './perimeter-measurement-label';
import type {ArcAnnotationMetadata} from './arc-measurement';
import type {MeasurementAppearanceController} from './measurement-appearance-controller';
import type {MeasurementState} from './measurement-state';
import type {MeasurementHistory} from './measurement-history';
import type {MeasurementRecord} from './measurement.models';

export interface MeasurementEventsOptions {
  state: Pick<MeasurementState, 'activate' | 'upsert' | 'remove'>;
  history: Pick<MeasurementHistory, 'recordCreation'>;
  appearance: Pick<MeasurementAppearanceController,
    'deleteDistanceDecorations' | 'deleteArcDecorations' | 'deleteShapeMeasurementLabel' |
    'deletePerimeterMeasurementLabel' | 'normalizeArcAnnotation' | 'syncArcDecorations' |
    'syncDistanceAppearance' | 'syncShapeMeasurementLabel' | 'syncPerimeterMeasurementLabel'>;
  getActiveDocumentId(): string | null | undefined;
  measure(annotation: PdfAnnotationObject): MeasurementRecord | null;
  onDeleted(annotationId: string): void;
  onSelectionRefresh(): void;
}

/** Coordinates measurement events; application-specific annotations stay with the host. */
export class MeasurementEventsController {
  constructor(private readonly options: MeasurementEventsOptions) {}
  private measure(annotation: PdfAnnotationObject) {return this.options.measure(annotation);}
  handle(event: AnnotationEvent): void {
    if (event.type === 'delete') {
      this.options.state.remove(event.documentId, event.annotation.id);
      this.options.onDeleted(event.annotation.id);
      if (
        event.annotation.type === PdfAnnotationSubtype.LINE
        && isMeasurementAnnotation(event.annotation, 'distance')
      ) {
        this.options.appearance.deleteDistanceDecorations(event.annotation as PdfLineAnnoObject);
      }
      if (
        event.annotation.type === PdfAnnotationSubtype.POLYLINE
        && isMeasurementAnnotation(event.annotation, 'arc')
      ) {
        this.options.appearance.deleteArcDecorations(event.annotation as PdfPolylineAnnoObject);
      }
      if (isShapeMeasurementAnnotation(event.annotation)) {
        this.options.appearance.deleteShapeMeasurementLabel(event.annotation);
      }
      if (isPerimeterMeasurementAnnotation(event.annotation)) {
        this.options.appearance.deletePerimeterMeasurementLabel(event.annotation);
      }
      return;
    }

    if (event.type !== 'create' && event.type !== 'update') {
      return;
    }

    let annotation = event.type === 'update'
      ? {...event.annotation, ...event.patch} as PdfAnnotationObject
      : event.annotation;
    if (isDistanceDecoration(annotation)) {
      return;
    }
    if (
      annotation.type === PdfAnnotationSubtype.POLYLINE
      && isMeasurementAnnotation(annotation, 'arc')
    ) {
      const patchMetadata = event.type === 'update'
        ? event.patch.custom as ArcAnnotationMetadata | undefined
        : undefined;
      if (
        event.type === 'update'
        && event.committed
        && 'vertices' in event.patch
        && patchMetadata?.arcGenerated !== true
      ) {
        annotation = {
          ...annotation,
          custom: {...(annotation.custom ?? {}), arcGenerated: false}
        } as PdfPolylineAnnoObject;
      }
      const normalizedArc = this.options.appearance.normalizeArcAnnotation(annotation);
      if (!normalizedArc) {
        return;
      }
      annotation = normalizedArc;
      this.options.appearance.syncArcDecorations(normalizedArc);
    }
    const measurement = this.measure(annotation);
    if (!measurement) {
      return;
    }

    this.options.state.activate(this.options.getActiveDocumentId() ?? null);
    this.options.state.upsert(event.documentId, measurement);

    if (annotation.type === PdfAnnotationSubtype.LINE && measurement.kind === 'distance') {
      this.options.appearance.syncDistanceAppearance(annotation, measurement.formattedValue);
    }
    if (isShapeMeasurementAnnotation(annotation)) {
      this.options.appearance.syncShapeMeasurementLabel(annotation, measurement.formattedValue);
    }
    if (isPerimeterMeasurementAnnotation(annotation)) {
      this.options.appearance.syncPerimeterMeasurementLabel(annotation, measurement.formattedValue);
    }
    if (event.type === 'create') {
      this.options.history.recordCreation(event.documentId, annotation);
    }
    this.options.onSelectionRefresh();
  }
}
