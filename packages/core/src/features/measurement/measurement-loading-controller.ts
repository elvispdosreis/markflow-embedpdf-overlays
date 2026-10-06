import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/models';
import {isMeasurementAnnotation} from './measurement-tools';
import {isDistanceDecoration} from './distance-measurement';
import {isShapeMeasurementAnnotation} from './shape-measurement-label';
import {isPerimeterMeasurementAnnotation} from './perimeter-measurement-label';
import type {MeasurementEventsOptions} from './measurement-events-controller';
import type {MeasurementState} from './measurement-state';
import type {MeasurementHistory} from './measurement-history';
import type {MeasurementRecord} from './measurement.models';
export interface MeasurementLoadingOptions {
  getAnnotation(): AnnotationCapability | undefined;
  getActiveDocumentId(): string | null | undefined;
  state: Pick<MeasurementState, 'activate' | 'replace' | 'update'>;
  history: Pick<MeasurementHistory, 'markLoaded'>;
  appearance: MeasurementEventsOptions['appearance'];
  measure(annotation: PdfAnnotationObject): MeasurementRecord | null;
  onSelectionRefresh(): void;
}
/** Rebuilds imported/loaded measurement results and their appearances. */
export class MeasurementLoadingController {
  private destroyed = false;
  private readonly timers = new Set<number>();
  constructor(private readonly options: MeasurementLoadingOptions) {}
  defer(action: () => void): void {
    if (this.destroyed) return;
    const id = this.options.getActiveDocumentId();
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (!this.destroyed && id === this.options.getActiveDocumentId()) action();
    }, 0);
    this.timers.add(timer);
  }
  destroy(): void {
    this.destroyed = true;
    this.timers.forEach(timer => window.clearTimeout(timer)); this.timers.clear();
  }
  private updateResults(update: (items: MeasurementRecord[]) => MeasurementRecord[]): void {
    const id = this.options.getActiveDocumentId();
    if (id) {this.options.state.activate(id); this.options.state.update(id, update);}
  }
  refreshImportedAnnotations(annotations: PdfAnnotationObject[]): void {
    const normalizedAnnotations = annotations.map(annotation => (
      annotation.type === PdfAnnotationSubtype.POLYLINE && isMeasurementAnnotation(annotation, 'arc')
        ? this.options.appearance.normalizeArcAnnotation(annotation) ?? annotation
        : annotation
    ));
    const measurements = normalizedAnnotations
      .map(annotation => this.options.measure(annotation))
      .filter((measurement): measurement is MeasurementRecord => measurement !== null);
    this.updateResults(current => [
      ...measurements,
      ...current.filter(item => !measurements.some(measurement => measurement.annotationId === item.annotationId))
    ].slice(0, 20));

    for (const annotation of normalizedAnnotations) {
      if (annotation.type === PdfAnnotationSubtype.LINE && isMeasurementAnnotation(annotation, 'distance')) {
        const measurement = this.options.measure(annotation);
        if (measurement) {
          this.options.appearance.syncDistanceAppearance(annotation, measurement.formattedValue);
        }
      }
      if (annotation.type === PdfAnnotationSubtype.POLYLINE && isMeasurementAnnotation(annotation, 'arc')) {
        this.options.appearance.syncArcDecorations(annotation);
      }
      if (isShapeMeasurementAnnotation(annotation)) {
        const measurement = this.options.measure(annotation);
        if (measurement) {
          this.options.appearance.syncShapeMeasurementLabel(annotation, measurement.formattedValue);
        }
      }
      if (isPerimeterMeasurementAnnotation(annotation)) {
        const measurement = this.options.measure(annotation);
        if (measurement) {
          this.options.appearance.syncPerimeterMeasurementLabel(annotation, measurement.formattedValue);
        }
      }
    }
    this.options.onSelectionRefresh();
  }
  refreshLoadedMeasurements(): void {
    const api = this.options.getAnnotation();
    if (!api) {
      return;
    }
    const annotations = api.getAnnotations()
      .map(item => item.object)
      .filter(annotation => !isDistanceDecoration(annotation));
    const measurements = annotations
      .map(annotation => this.options.measure(annotation))
      .filter((measurement): measurement is MeasurementRecord => measurement !== null);
    const documentId = this.options.getActiveDocumentId();
    if (documentId) {
      this.options.state.activate(documentId);
      this.options.state.replace(documentId, measurements);
      this.options.history.markLoaded(documentId, measurements.map(item => item.annotationId));
    }
    for (const annotation of annotations) {
      if (annotation.type === PdfAnnotationSubtype.LINE && isMeasurementAnnotation(annotation, 'distance')) {
        const measurement = this.options.measure(annotation);
        if (measurement) {
          this.options.appearance.syncDistanceAppearance(annotation, measurement.formattedValue);
        }
      }
      if (annotation.type === PdfAnnotationSubtype.POLYLINE && isMeasurementAnnotation(annotation, 'arc')) {
        const normalized = this.options.appearance.normalizeArcAnnotation(annotation);
        if (normalized) {
          this.options.appearance.syncArcDecorations(normalized);
        }
      }
      if (isShapeMeasurementAnnotation(annotation)) {
        const measurement = this.options.measure(annotation);
        if (measurement) {
          this.options.appearance.syncShapeMeasurementLabel(annotation, measurement.formattedValue);
        }
      }
      if (isPerimeterMeasurementAnnotation(annotation)) {
        const measurement = this.options.measure(annotation);
        if (measurement) {
          this.options.appearance.syncPerimeterMeasurementLabel(annotation, measurement.formattedValue);
        }
      }
    }
  }
}
