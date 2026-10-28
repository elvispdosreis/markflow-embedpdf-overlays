import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {HistoryCapability} from '@embedpdf/plugin-history';
import {calculateRotatedRectAABBAroundPoint, PdfAnnotationSubtype, type PdfAnnotationObject, type PdfLineAnnoObject, type PdfPolylineAnnoObject} from '@embedpdf/models';
import {arcAnnotationPatch, arcDecorationIds, arcGeometryFromAnnotation, arcNeedsNormalization, buildArcDecorations} from './arc-measurement';
import {buildDistanceDecorations, distanceDecorationIds, distanceLineNeedsDecoration, distanceLinePatch} from './distance-measurement';
import {buildPerimeterMeasurementLabel, isPerimeterMeasurementAnnotation, perimeterMeasurementLabelIds, perimeterMeasurementNeedsLabel, perimeterMeasurementPatch} from './perimeter-measurement-label';
import {buildShapeMeasurementLabel, isShapeMeasurementAnnotation, shapeMeasurementDecorationIds, shapeMeasurementNeedsLabel, shapeMeasurementPatch, type ShapeMeasurementAnnotation} from './shape-measurement-label';
import {buildMeasurementFill, measurementFillDecorationId} from './measurement-fill';
import {annotationCalibration} from './measurement-calibration';
import {MeasurementCalculator} from './measurement-calculator';
import {measurementRecord} from './measurement-record';
import {isMeasurementAnnotation} from './measurement-tools';
import type {Calibration} from './measurement.models';

export interface MeasurementAppearanceOptions {
  getAnnotation(): AnnotationCapability | undefined;
  getHistory(): HistoryCapability | undefined;
  getActiveDocumentId(): string | null | undefined;
  getCalibration(): Calibration;
  onInvalidArc(): void;
  onSelectionRefresh(kind: 'distance' | 'arc'): void;
  onDistanceDeleted(annotationId: string): void;
  /** Page rotation in quarter turns (0–3). Labels are turned so they read upright on screen. */
  getPageRotation?(pageIndex: number): number;
}

/** Synchronizes measurement labels and decorations without depending on the host renderer. */
export class MeasurementAppearanceController {
  private readonly calculator = new MeasurementCalculator();
  constructor(private readonly options: MeasurementAppearanceOptions) {}
  private get annotationApi(): AnnotationCapability | undefined {return this.options.getAnnotation();}
  private get calibration(): Calibration {return this.options.getCalibration();}
  private measure(annotation: PdfAnnotationObject) {
    return measurementRecord(annotation, this.calibration, this.calculator);
  }

  normalizeArcAnnotation(annotation: PdfPolylineAnnoObject): PdfPolylineAnnoObject | null {
    const geometry = arcGeometryFromAnnotation(annotation);
    if (!geometry) {
      this.options.onInvalidArc();
      return null;
    }

    const calibration = annotationCalibration(annotation, this.calibration);
    const formattedLength = this.calculator.format(
      this.calculator.arcLength(geometry.radius, geometry.sweepRadians, calibration),
      calibration
    );
    const appearancePatch = arcAnnotationPatch(annotation, formattedLength);
    const geometryPatch = arcNeedsNormalization(annotation) && this.annotationApi
      ? this.annotationApi.transformAnnotation(annotation, {
          type: 'vertex-edit',
          changes: {vertices: geometry.points}
        })
      : {};
    const patch = {...geometryPatch, ...appearancePatch};

    if (
      this.annotationApi
      && (arcNeedsNormalization(annotation) || annotation.contents !== formattedLength)
    ) {
      this.annotationApi.syncAnnotationObject(annotation.id, patch);
    }

    return {...annotation, ...patch} as PdfPolylineAnnoObject;
  }

  syncArcDecorations(annotation: PdfPolylineAnnoObject): void {
    if (!this.annotationApi) {
      return;
    }
    const geometry = arcGeometryFromAnnotation(annotation);
    if (!geometry) {
      return;
    }
    const calibration = annotationCalibration(annotation, this.calibration);
    const formattedLength = this.calculator.format(
      this.calculator.arcLength(geometry.radius, geometry.sweepRadians, calibration),
      calibration
    );
    const ids = arcDecorationIds(annotation.id);
    for (const decoration of buildArcDecorations(annotation, formattedLength, geometry, ids)) {
      this.upsertGeneratedAnnotation(decoration);
    }
  }

  deleteArcDecorations(annotation: PdfPolylineAnnoObject): void {
    if (!this.annotationApi) {
      return;
    }
    for (const id of Object.values(arcDecorationIds(annotation.id))) {
      const decoration = this.annotationApi.getAnnotationById(id)?.object;
      if (decoration) {
        this.deleteGeneratedAnnotation(decoration);
      }
    }
  }

  syncShapeMeasurementLabel(
    annotation: ShapeMeasurementAnnotation,
    formattedValue: string
  ): void {
    if (!this.annotationApi) {
      return;
    }

    const ids = shapeMeasurementDecorationIds(annotation.id);
    const fillId = measurementFillDecorationId(annotation.id);
    const fill = buildMeasurementFill(annotation);
    const existingFill = this.annotationApi.getAnnotationById(fillId)?.object;
    if (fill) {
      if (JSON.stringify(existingFill) !== JSON.stringify(fill)) this.upsertGeneratedAnnotation(fill);
    } else if (existingFill) this.deleteGeneratedAnnotation(existingFill);
    if (shapeMeasurementNeedsLabel(annotation, formattedValue, ids)) {
      this.annotationApi.syncAnnotationObject(
        annotation.id,
        shapeMeasurementPatch(annotation, formattedValue, ids)
      );
    }

    const label = buildShapeMeasurementLabel(annotation, formattedValue, ids);
    this.upsertGeneratedAnnotation(label);
  }

  deleteShapeMeasurementLabel(annotation: ShapeMeasurementAnnotation): void {
    if (!this.annotationApi) {
      return;
    }
    const id = shapeMeasurementDecorationIds(annotation.id).label;
    const fill = this.annotationApi.getAnnotationById(measurementFillDecorationId(annotation.id))?.object;
    if (fill) this.deleteGeneratedAnnotation(fill);
    const label = this.annotationApi.getAnnotationById(id)?.object;
    if (label) {
      this.deleteGeneratedAnnotation(label);
    }
  }

  refreshShapeMeasurementLabels(): void {
    if (!this.annotationApi) {
      return;
    }
    for (const tracked of this.annotationApi.getAnnotations()) {
      const annotation = tracked.object;
      if (!isShapeMeasurementAnnotation(annotation)) {
        continue;
      }
      const measurement = this.measure(annotation);
      if (measurement) {
        this.syncShapeMeasurementLabel(annotation, measurement.formattedValue);
      }
    }
  }

  syncPerimeterMeasurementLabel(annotation: PdfPolylineAnnoObject, formattedValue: string): void {
    if (!this.annotationApi) return;
    const ids = perimeterMeasurementLabelIds(annotation.id);
    if (perimeterMeasurementNeedsLabel(annotation, formattedValue, ids)) {
      this.annotationApi.syncAnnotationObject(annotation.id, perimeterMeasurementPatch(annotation, formattedValue, ids));
    }
    this.upsertGeneratedAnnotation(buildPerimeterMeasurementLabel(annotation, formattedValue, ids));
  }

  deletePerimeterMeasurementLabel(annotation: PdfPolylineAnnoObject): void {
    if (!this.annotationApi) return;
    const label = this.annotationApi.getAnnotationById(perimeterMeasurementLabelIds(annotation.id).label)?.object;
    if (label) this.deleteGeneratedAnnotation(label);
  }

  refreshPerimeterMeasurementLabels(): void {
    if (!this.annotationApi) return;
    for (const tracked of this.annotationApi.getAnnotations()) {
      const annotation = tracked.object;
      if (!isPerimeterMeasurementAnnotation(annotation)) continue;
      const measurement = this.measure(annotation);
      if (measurement) this.syncPerimeterMeasurementLabel(annotation, measurement.formattedValue);
    }
  }

  syncDistanceAppearance(line: PdfLineAnnoObject, formattedDistance: string): void {
    if (!this.annotationApi) {
      return;
    }

    const ids = distanceDecorationIds(line.id);
    if (distanceLineNeedsDecoration(line, formattedDistance)) {
      this.annotationApi.syncAnnotationObject(line.id, distanceLinePatch(line, formattedDistance, ids));
    }

    for (const decoration of buildDistanceDecorations(line, formattedDistance, ids)) {
      this.upsertGeneratedAnnotation(decoration);
    }
  }

  deleteDistanceDecorations(line: PdfLineAnnoObject): void {
    if (!this.annotationApi) {
      return;
    }

    const ids = distanceDecorationIds(line.id);
    for (const id of Object.values(ids)) {
      const decoration = this.annotationApi.getAnnotationById(id)?.object;
      if (decoration) {
        this.deleteGeneratedAnnotation(decoration);
      }
    }
    this.options.onDistanceDeleted(line.id);
  }

  private upsertGeneratedAnnotation(generated: PdfAnnotationObject): void {
    if (!this.annotationApi) return;
    const annotation = this.uprightLabel(generated);
    if (this.annotationApi.getAnnotationById(annotation.id)) {
      this.annotationApi.updateAnnotation(annotation.pageIndex, annotation.id, annotation);
      this.purgeGeneratedAnnotationHistory(annotation.id);
    } else {
      this.annotationApi.importAnnotations([{annotation}]);
    }
  }

  /** Labels are built in page axes; on a rotated page they are turned back to read upright. */
  private uprightLabel(annotation: PdfAnnotationObject): PdfAnnotationObject {
    if (annotation.type !== PdfAnnotationSubtype.FREETEXT) return annotation;
    const turn = ((Math.round(this.options.getPageRotation?.(annotation.pageIndex) ?? 0) % 4) + 4) % 4;
    if (!turn) return annotation;
    const rotation = (4 - turn) * 90;
    const {rect} = annotation;
    const center = {x: rect.origin.x + rect.size.width / 2, y: rect.origin.y + rect.size.height / 2};
    return {...annotation, rotation, unrotatedRect: rect,
      rect: calculateRotatedRectAABBAroundPoint(rect, rotation, center)};
  }

  private deleteGeneratedAnnotation(annotation: PdfAnnotationObject): void {
    if (!this.annotationApi) return;
    this.annotationApi.deleteAnnotation(annotation.pageIndex, annotation.id);
    this.purgeGeneratedAnnotationHistory(annotation.id);
  }

  private purgeGeneratedAnnotationHistory(annotationId: string): void {
    const documentId = this.options.getActiveDocumentId();
    if (!documentId) return;
    this.options.getHistory()?.forDocument(documentId).purgeByMetadata<{annotationIds?: string[]}>(
      metadata => Boolean(metadata?.annotationIds?.includes(annotationId)),
      'annotations'
    );
  }

  refreshDistanceDecorations(): void {
    if (!this.annotationApi) {
      return;
    }

    for (const tracked of this.annotationApi.getAnnotations()) {
      const annotation = tracked.object;
      if (
        annotation.type !== PdfAnnotationSubtype.LINE
        || !isMeasurementAnnotation(annotation, 'distance')
      ) {
        continue;
      }
      const measurement = this.measure(annotation);
      if (measurement) {
        this.syncDistanceAppearance(annotation, measurement.formattedValue);
      }
    }
    this.options.onSelectionRefresh('distance');
  }

  refreshArcAppearances(): void {
    if (!this.annotationApi) {
      return;
    }

    for (const tracked of this.annotationApi.getAnnotations()) {
      const annotation = tracked.object;
      if (
        annotation.type !== PdfAnnotationSubtype.POLYLINE
        || !isMeasurementAnnotation(annotation, 'arc')
      ) {
        continue;
      }
      const normalized = this.normalizeArcAnnotation(annotation);
      if (normalized) {
        this.syncArcDecorations(normalized);
      }
    }
    this.options.onSelectionRefresh('arc');
  }

}
