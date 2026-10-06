import {
  type AnnotationTool,
  PdfAnnotationBorderStyle,
  PdfAnnotationLineEnding,
  PdfAnnotationSubtype,
  type PdfFreeTextAnnoObject,
  type PdfLineAnnoObject,
  type PdfAnnotationObject,
  type LinePoints,
  type Position,
  type Rect
} from '@embedpdf/snippet';

const ANGLE_STEP_DEGREES = 22.5;
let angleConstraintActive = false;

const LABEL_HEIGHT = 14;
const MINIMUM_LABEL_WIDTH = 40;
const WITNESS_LINE_HALF_LENGTH = 7;

export interface DistanceDecorationIds {
  label: string;
  startWitness: string;
  endWitness: string;
}

export interface DistanceAnnotationMetadata {
  measurementKind?: 'distance';
  measurementDecorationFor?: string;
  measurementDecorationIds?: DistanceDecorationIds;
}

export interface DistanceMeasurementDetails {
  annotationId: string;
  pageIndex: number;
  formattedDistance: string;
  formattedAngle: string;
  formattedXAxis: string;
  formattedYAxis: string;
  distanceValue: number;
  angleValue: number;
  strokeColor: string;
  strokeWidth: number;
}

export function setDistanceAngleConstraintActive(active: boolean): void {
  angleConstraintActive = active;
}

export function snapDistanceEndpoint(start: Position, end: Position): Position {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) return end;

  const angle = Math.atan2(deltaY, deltaX);
  const step = ANGLE_STEP_DEGREES * Math.PI / 180;
  const snappedAngle = Math.round(angle / step) * step;
  const x = start.x + Math.cos(snappedAngle) * length;
  const y = start.y + Math.sin(snappedAngle) * length;
  return {
    x: Math.abs(x) < 1e-10 ? 0 : x,
    y: Math.abs(y) < 1e-10 ? 0 : y
  };
}

export function createDistancePointerHandler(): NonNullable<AnnotationTool<PdfLineAnnoObject>['pointerHandler']> {
  return {
    annotationType: PdfAnnotationSubtype.LINE,
    create(context) {
      let start: Position | null = null;
      let moved = false;

      const clamp = (point: Position): Position => ({
        x: Math.max(0, Math.min(context.pageSize.width, point.x)),
        y: Math.max(0, Math.min(context.pageSize.height, point.y))
      });
      const constrainedEnd = (point: Position, shiftKey: boolean): Position => {
        if (!start || !shiftKey) return clamp(point);
        return snapDistanceEndpointWithinPage(start, clamp(point), context.pageSize);
      };
      const defaults = () => {
        const tool = context.getTool();
        if (!tool) return null;
        return {
          ...tool.defaults,
          strokeWidth: tool.defaults.strokeWidth ?? 1,
          lineEndings: tool.defaults.lineEndings ?? {
            start: PdfAnnotationLineEnding.None,
            end: PdfAnnotationLineEnding.None
          },
          color: tool.defaults.color ?? '#000000',
          opacity: tool.defaults.opacity ?? 1,
          strokeStyle: tool.defaults.strokeStyle ?? PdfAnnotationBorderStyle.SOLID,
          strokeDashArray: tool.defaults.strokeDashArray ?? [],
          strokeColor: tool.defaults.strokeColor ?? '#000000',
          flags: tool.defaults.flags ?? ['print']
        };
      };
      const preview = (end: Position) => {
        if (!start) return;
        const values = defaults();
        if (!values) return;
        const rect = distanceLineRect(start, end, values.strokeWidth);
        context.onPreview({
          type: PdfAnnotationSubtype.LINE,
          bounds: rect,
          data: {...values, rect, linePoints: {start, end}}
        });
      };
      const commit = (lineStart: Position, lineEnd: Position) => {
        const values = defaults();
        if (!values) return;
        context.onCommit({
          ...values,
          type: PdfAnnotationSubtype.LINE,
          pageIndex: context.pageIndex,
          id: crypto.randomUUID(),
          created: new Date(),
          rect: distanceLineRect(lineStart, lineEnd, values.strokeWidth),
          linePoints: {start: lineStart, end: lineEnd}
        } as PdfLineAnnoObject);
      };
      const reset = (event?: {releasePointerCapture?: () => void}) => {
        start = null;
        moved = false;
        context.onPreview(null);
        event?.releasePointerCapture?.();
      };

      return {
        onPointerDown: (point, event) => {
          start = clamp(point);
          moved = false;
          preview(start);
          event.setPointerCapture?.();
        },
        onPointerMove: (point, event) => {
          if (!start) return;
          const end = constrainedEnd(point, event.shiftKey);
          moved ||= Math.hypot(end.x - start.x, end.y - start.y) >= 5;
          if (moved) preview(end);
        },
        onPointerUp: (point, event) => {
          if (!start) return;
          const lineStart = start;
          const end = constrainedEnd(point, event.shiftKey);
          if (moved && Math.hypot(end.x - lineStart.x, end.y - lineStart.y) > 2) {
            commit(lineStart, end);
          } else {
            const tool = context.getTool();
            const click = tool?.clickBehavior;
            if (click?.enabled) {
              const halfLength = click.defaultLength / 2;
              const angle = click.defaultAngle ?? 0;
              const center = clamp(point);
              commit(
                clamp({x: center.x - Math.cos(angle) * halfLength, y: center.y - Math.sin(angle) * halfLength}),
                clamp({x: center.x + Math.cos(angle) * halfLength, y: center.y + Math.sin(angle) * halfLength})
              );
            }
          }
          reset(event);
        },
        onPointerLeave: (_point, event) => reset(event),
        onPointerCancel: (_point, event) => reset(event)
      };
    }
  };
}

export function createDistanceTransform(
  baseTransform: AnnotationTool<PdfLineAnnoObject>['transform']
): NonNullable<AnnotationTool<PdfLineAnnoObject>['transform']> {
  return (original, context) => {
    if (context.type !== 'vertex-edit' || !context.changes.linePoints || !angleConstraintActive) {
      return baseTransform?.(original, context) ?? context.changes;
    }

    const points = context.changes.linePoints;
    const startMoved = Math.hypot(
      points.start.x - original.linePoints.start.x,
      points.start.y - original.linePoints.start.y
    );
    const endMoved = Math.hypot(
      points.end.x - original.linePoints.end.x,
      points.end.y - original.linePoints.end.y
    );
    const linePoints = startMoved > endMoved
      ? {start: snapDistanceEndpoint(points.end, points.start), end: points.end}
      : {start: points.start, end: snapDistanceEndpoint(points.start, points.end)};

    const constrainedContext = {
      ...context,
      changes: {...context.changes, linePoints}
    };
    return baseTransform?.(original, constrainedContext) ?? constrainedContext.changes;
  };
}

export function distanceDecorationIds(annotationId: string): DistanceDecorationIds {
  return {
    label: `${annotationId}-measurement-label`,
    startWitness: `${annotationId}-measurement-start`,
    endWitness: `${annotationId}-measurement-end`
  };
}

export function isDistanceDecoration(annotation: PdfAnnotationObject): boolean {
  return Boolean((annotation.custom as DistanceAnnotationMetadata | undefined)?.measurementDecorationFor);
}

export function distanceLineNeedsDecoration(line: PdfLineAnnoObject, formattedDistance: string): boolean {
  const metadata = line.custom as DistanceAnnotationMetadata | undefined;
  return line.contents !== formattedDistance
    || line.intent !== 'LineDimension'
    || line.lineEndings?.start !== PdfAnnotationLineEnding.ClosedArrow
    || line.lineEndings?.end !== PdfAnnotationLineEnding.ClosedArrow
    || !metadata?.measurementDecorationIds;
}

export function distanceLinePatch(
  line: PdfLineAnnoObject,
  formattedDistance: string,
  ids = distanceDecorationIds(line.id)
): Partial<PdfLineAnnoObject> {
  return {
    contents: formattedDistance,
    intent: 'LineDimension',
    subject: 'Medição de distância',
    lineEndings: {
      start: PdfAnnotationLineEnding.ClosedArrow,
      end: PdfAnnotationLineEnding.ClosedArrow
    },
    custom: {
      ...(line.custom ?? {}),
      measurementKind: 'distance',
      measurementDecorationIds: ids
    } satisfies DistanceAnnotationMetadata
  };
}

export function buildDistanceDecorations(
  line: PdfLineAnnoObject,
  formattedDistance: string,
  ids = distanceDecorationIds(line.id)
): [PdfLineAnnoObject, PdfLineAnnoObject, PdfFreeTextAnnoObject] {
  const {start, end} = line.linePoints;
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const perpendicular = {
    x: -(end.y - start.y) / length,
    y: (end.x - start.x) / length
  };
  const strokeColor = line.strokeColor || '#ef4444';
  const strokeWidth = line.strokeWidth || 1;
  const commonCustom = {measurementDecorationFor: line.id} satisfies DistanceAnnotationMetadata;

  const startWitness = witnessLine(
    ids.startWitness,
    line,
    start,
    perpendicular,
    strokeColor,
    strokeWidth,
    commonCustom
  );
  const endWitness = witnessLine(
    ids.endWitness,
    line,
    end,
    perpendicular,
    strokeColor,
    strokeWidth,
    commonCustom
  );

  const middle = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
  const labelWidth = Math.max(MINIMUM_LABEL_WIDTH, formattedDistance.length * 6.2);
  const label: PdfFreeTextAnnoObject = {
    id: ids.label,
    pageIndex: line.pageIndex,
    type: PdfAnnotationSubtype.FREETEXT,
    rect: {
      origin: {
        x: middle.x - labelWidth / 2,
        y: middle.y - LABEL_HEIGHT / 2
      },
      size: {width: labelWidth, height: LABEL_HEIGHT}
    },
    contents: formattedDistance,
    fontFamily: 5 as PdfFreeTextAnnoObject['fontFamily'],
    fontSize: 10,
    fontColor: strokeColor,
    textAlign: 1 as PdfFreeTextAnnoObject['textAlign'],
    verticalAlign: 1 as PdfFreeTextAnnoObject['verticalAlign'],
    opacity: 1,
    color: 'transparent',
    backgroundColor: 'transparent',
    strokeColor,
    strokeWidth: 0,
    author: line.author,
    subject: 'Valor da medição',
    flags: ['print', 'readOnly', 'locked'],
    custom: commonCustom
  };

  return [startWitness, endWitness, label];
}

export function distanceDetails(
  line: PdfLineAnnoObject,
  linearFactor: number,
  unit: string,
  precision: number
): DistanceMeasurementDetails {
  const deltaX = (line.linePoints.end.x - line.linePoints.start.x) * linearFactor;
  const deltaY = (line.linePoints.end.y - line.linePoints.start.y) * linearFactor;
  const distance = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  const format = (value: number) => value.toLocaleString('pt-BR', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  return {
    annotationId: line.id,
    pageIndex: line.pageIndex,
    formattedDistance: `${format(distance)} ${unit}`,
    formattedAngle: `${format(angle)}°`,
    formattedXAxis: `${format(Math.abs(deltaX))} ${unit}`,
    formattedYAxis: `${format(Math.abs(deltaY))} ${unit}`,
    distanceValue: distance,
    angleValue: angle,
    strokeColor: line.strokeColor || '#ef4444',
    strokeWidth: line.strokeWidth || 1
  };
}

export function linePointsForDistance(
  start: Position,
  distance: number,
  angleDegrees: number,
  linearFactor: number
): LinePoints {
  const angle = angleDegrees * Math.PI / 180;
  const pdfLength = distance / linearFactor;
  return {
    start,
    end: {
      x: start.x + Math.cos(angle) * pdfLength,
      y: start.y + Math.sin(angle) * pdfLength
    }
  };
}

function witnessLine(
  id: string,
  owner: PdfLineAnnoObject,
  center: Position,
  perpendicular: Position,
  strokeColor: string,
  strokeWidth: number,
  custom: DistanceAnnotationMetadata
): PdfLineAnnoObject {
  const start = {
    x: center.x - perpendicular.x * WITNESS_LINE_HALF_LENGTH,
    y: center.y - perpendicular.y * WITNESS_LINE_HALF_LENGTH
  };
  const end = {
    x: center.x + perpendicular.x * WITNESS_LINE_HALF_LENGTH,
    y: center.y + perpendicular.y * WITNESS_LINE_HALF_LENGTH
  };

  return {
    id,
    pageIndex: owner.pageIndex,
    type: PdfAnnotationSubtype.LINE,
    rect: lineRect(start, end, strokeWidth + 2),
    linePoints: {start, end},
    lineEndings: {
      start: PdfAnnotationLineEnding.None,
      end: PdfAnnotationLineEnding.None
    },
    color: 'transparent',
    opacity: owner.opacity ?? 1,
    strokeWidth,
    strokeColor,
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
    author: owner.author,
    subject: 'Linha auxiliar da medição',
    flags: ['print', 'readOnly', 'locked'],
    custom
  };
}

export function snapDistanceEndpointWithinPage(
  start: Position,
  end: Position,
  pageSize: {width: number; height: number}
): Position {
  const snappedEnd = snapDistanceEndpoint(start, end);
  const delta = {x: snappedEnd.x - start.x, y: snappedEnd.y - start.y};
  let factor = 1;
  if (delta.x > 0) factor = Math.min(factor, (pageSize.width - start.x) / delta.x);
  if (delta.x < 0) factor = Math.min(factor, (0 - start.x) / delta.x);
  if (delta.y > 0) factor = Math.min(factor, (pageSize.height - start.y) / delta.y);
  if (delta.y < 0) factor = Math.min(factor, (0 - start.y) / delta.y);
  return {x: start.x + delta.x * factor, y: start.y + delta.y * factor};
}

function distanceLineRect(start: Position, end: Position, strokeWidth: number): Rect {
  return lineRect(start, end, Math.max(2, strokeWidth * 10));
}

function lineRect(start: Position, end: Position, padding: number): Rect {
  const left = Math.min(start.x, end.x) - padding;
  const top = Math.min(start.y, end.y) - padding;
  const right = Math.max(start.x, end.x) + padding;
  const bottom = Math.max(start.y, end.y) + padding;
  return {
    origin: {x: left, y: top},
    size: {width: right - left, height: bottom - top}
  };
}
