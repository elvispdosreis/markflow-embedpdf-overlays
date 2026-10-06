import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {PdfLineAnnoObject, PdfPolylineAnnoObject, Position} from '@embedpdf/models';
import {arcThroughVertexIndex} from './arc-measurement';
import {annotationCalibration} from './measurement-calibration';
import {distanceDecorationIds, linePointsForDistance, type DistanceMeasurementDetails} from './distance-measurement';
import type {Calibration} from './measurement.models';

export interface LiveDistancePreview {
  start: Position;
  end: Position;
  middle: Position;
  perpendicular: Position;
  formattedDistance: string;
  strokeColor: string;
  strokeWidth: number;
}

export interface MeasurementInteractionOptions {
  root: ShadowRoot;
  annotation: AnnotationCapability;
  getActiveDocumentId(): string | null;
  getHostBounds(): {left: number; top: number};
  getCalibration(): Calibration;
  getSelectedLine(): PdfLineAnnoObject | null;
  getSelectedArc(): PdfPolylineAnnoObject | null;
  getDistanceDetails(): DistanceMeasurementDetails | null;
  onPreview(preview: LiveDistancePreview | null): void;
  onDistanceDetails(details: DistanceMeasurementDetails): void;
  onDistanceSettled(documentId: string, annotationId: string): void;
}

interface DistanceDrag {
  documentId: string;
  annotationId: string;
  realUnitsPerScreenPixel: number;
}

/** Owns transient interaction state, listeners, animation frames and delayed settlement. */
export class MeasurementInteraction {
  private readonly abort = new AbortController();
  private drag?: DistanceDrag;
  private settlingDrag?: DistanceDrag;
  private previewFrame?: number;
  private arcFrame?: number;
  private settleTimer?: number;
  private destroyed = false;

  constructor(private readonly options: MeasurementInteractionOptions) {
    const listenerOptions = {capture: true, signal: this.abort.signal};
    options.root.addEventListener('pointerdown', this.pointerDown as EventListener, listenerOptions);
    window.addEventListener('pointermove', this.pointerMove, listenerOptions);
    window.addEventListener('pointerup', this.pointerUp, listenerOptions);
    window.addEventListener('pointercancel', this.pointerUp, listenerOptions);
  }

  get isDragging(): boolean {return Boolean(this.drag);}

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort.abort();
    this.cancel();
    if (this.arcFrame !== undefined) cancelAnimationFrame(this.arcFrame);
    // Return native handles to their default appearance when unmounting.
    this.options.root.querySelectorAll<HTMLElement>('[data-epdf-vertex]').forEach(handle => {
      handle.style.visibility = ''; handle.style.pointerEvents = '';
    });
  }

  cancel(): void {
    if (this.previewFrame !== undefined) cancelAnimationFrame(this.previewFrame);
    if (this.settleTimer !== undefined) window.clearTimeout(this.settleTimer);
    this.previewFrame = this.settleTimer = undefined;
    if (this.drag) this.setDecorationsVisible(this.drag, true);
    if (this.settlingDrag) this.setDecorationsVisible(this.settlingDrag, true);
    this.drag = undefined;
    this.settlingDrag = undefined;
    this.options.onPreview(null);
  }

  scheduleArcHandles(): void {
    if (this.destroyed) return;
    if (this.arcFrame !== undefined) cancelAnimationFrame(this.arcFrame);
    this.arcFrame = requestAnimationFrame(() => {
      this.arcFrame = undefined;
      const arc = this.options.getSelectedArc();
      const indexes = arc ? new Set([0, arcThroughVertexIndex(arc), arc.vertices.length - 1]) : null;
      this.options.root.querySelectorAll<HTMLElement>('[data-epdf-vertex]').forEach(handle => {
        const visible = !indexes || indexes.has(Number(handle.dataset['epdfVertex']));
        handle.style.visibility = visible ? '' : 'hidden';
        handle.style.pointerEvents = visible ? '' : 'none';
      });
    });
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (this.destroyed || event.button !== 0) return;
    const handle = event.composedPath().find(target => target instanceof HTMLElement
      && (target.hasAttribute('data-epdf-vertex') || target.hasAttribute('data-epdf-rotation-handle')));
    const line = this.options.getSelectedLine();
    const documentId = this.options.getActiveDocumentId();
    if (!handle || !line || !documentId) return;
    const handles = this.visibleHandles();
    if (handles.length !== 2) return;
    const start = elementCenter(handles[0]), end = elementCenter(handles[1]);
    const screenLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (screenLength <= 0) return;
    this.cancel();
    const calibration = annotationCalibration(line, this.options.getCalibration());
    const realLength = Math.hypot(line.linePoints.end.x - line.linePoints.start.x,
      line.linePoints.end.y - line.linePoints.start.y) * calibration.linearFactor;
    this.drag = {documentId, annotationId: line.id, realUnitsPerScreenPixel: realLength / screenLength};
    this.setDecorationsVisible(this.drag, false);
    this.schedulePreview();
  };

  private readonly pointerMove = (): void => {
    if (this.drag) this.schedulePreview();
  };

  private readonly pointerUp = (): void => {
    const drag = this.drag;
    if (!drag) return;
    if (this.options.getActiveDocumentId() !== drag.documentId) {this.cancel(); return;}
    if (this.previewFrame !== undefined) cancelAnimationFrame(this.previewFrame);
    this.previewFrame = undefined;
    this.drag = undefined;
    this.settlingDrag = drag;
    // Native transforms finish after pointerup; preserve the existing 80ms settlement delay.
    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = undefined;
      this.settlingDrag = undefined;
      this.setDecorationsVisible(drag, true);
      this.options.onPreview(null);
      if (this.options.getActiveDocumentId() === drag.documentId) {
        this.options.onDistanceSettled(drag.documentId, drag.annotationId);
      }
    }, 80);
  };

  private schedulePreview(): void {
    if (this.previewFrame !== undefined) cancelAnimationFrame(this.previewFrame);
    this.previewFrame = requestAnimationFrame(() => {
      this.previewFrame = undefined;
      this.updatePreview();
    });
  }

  private updatePreview(): void {
    const drag = this.drag, selected = this.options.getDistanceDetails();
    if (!drag) return;
    if (this.options.getActiveDocumentId() !== drag.documentId) {this.cancel(); return;}
    if (!selected || selected.annotationId !== drag.annotationId) {this.cancel(); return;}
    const handles = this.visibleHandles();
    if (handles.length !== 2) return;
    const line = this.options.annotation.forDocument(drag.documentId).getAnnotationById(drag.annotationId)?.object;
    const fallback = this.options.getCalibration();
    const calibration = line ? annotationCalibration(line, fallback) : fallback;
    const bounds = this.options.getHostBounds();
    const a = elementCenter(handles[0]), b = elementCenter(handles[1]);
    const start = {x: a.x - bounds.left, y: a.y - bounds.top};
    const end = {x: b.x - bounds.left, y: b.y - bounds.top};
    const dx = end.x - start.x, dy = end.y - start.y;
    const screenLength = Math.hypot(dx, dy) || 1;
    const distance = screenLength * drag.realUnitsPerScreenPixel;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const format = (value: number) => value.toLocaleString('pt-BR', {
      minimumFractionDigits: calibration.precision, maximumFractionDigits: calibration.precision
    });
    const formattedDistance = `${format(distance)} ${calibration.unit}`;
    this.options.onPreview({start, end, middle: {x: (start.x + end.x) / 2, y: (start.y + end.y) / 2},
      perpendicular: {x: -dy / screenLength, y: dx / screenLength}, formattedDistance,
      strokeColor: selected.strokeColor, strokeWidth: selected.strokeWidth});
    this.options.onDistanceDetails({...selected, formattedDistance, formattedAngle: `${format(angle)}°`,
      formattedXAxis: `${format(Math.abs(dx) * drag.realUnitsPerScreenPixel)} ${calibration.unit}`,
      formattedYAxis: `${format(Math.abs(dy) * drag.realUnitsPerScreenPixel)} ${calibration.unit}`,
      distanceValue: distance, angleValue: angle});
  }

  private visibleHandles(): HTMLElement[] {
    // EmbedPDF snippet DOM adapter, shared with its native vertex-edit handles.
    return Array.from(this.options.root.querySelectorAll<HTMLElement>('[data-epdf-vertex]'))
      .filter(handle => handle.getClientRects().length > 0)
      .sort((a, b) => Number(a.dataset['epdfVertex']) - Number(b.dataset['epdfVertex']));
  }

  private setDecorationsVisible(drag: DistanceDrag, visible: boolean): void {
    const scope = this.options.annotation.forDocument(drag.documentId);
    for (const id of Object.values(distanceDecorationIds(drag.annotationId))) {
      if (scope.getAnnotationById(id)) scope.syncAnnotationObject(id, {opacity: visible ? 1 : 0});
    }
  }
}

function elementCenter(element: HTMLElement): Position {
  const rect = element.getBoundingClientRect();
  return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
}

export function updateDistanceGeometry(annotation: AnnotationCapability, line: PdfLineAnnoObject,
  distance: number, angleDegrees: number, calibration: Calibration): void {
  if (calibration.linearFactor <= 0) return;
  const linePoints = linePointsForDistance(line.linePoints.start, distance, angleDegrees, calibration.linearFactor);
  const patch = annotation.transformAnnotation(line, {type: 'vertex-edit', changes: {linePoints}});
  annotation.updateAnnotation(line.pageIndex, line.id, patch);
}
