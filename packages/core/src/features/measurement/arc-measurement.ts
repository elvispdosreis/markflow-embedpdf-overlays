import {
  type AnnotationTool,
  PdfAnnotationBorderStyle,
  PdfAnnotationLineEnding,
  PdfAnnotationSubtype,
  type PdfFreeTextAnnoObject,
  type PdfLineAnnoObject,
  type PdfPolylineAnnoObject,
  type Position,
  type Rect
} from '@embedpdf/snippet';

const FULL_CIRCLE = Math.PI * 2;
const MINIMUM_SEGMENTS = 12;
const SEGMENTS_PER_CIRCLE = 64;
const COLLINEAR_RELATIVE_TOLERANCE = 1e-6;
const POINT_RELATIVE_TOLERANCE = 1e-7;
const MINIMUM_ABSOLUTE_DISTANCE = 1e-6;
const LABEL_HEIGHT = 14;
const MINIMUM_LABEL_WIDTH = 44;
const LABEL_RADIUS_RATIO = 0.55;
const INNER_ARC_RADIUS_RATIO = 0.18;
const MINIMUM_INNER_ARC_RADIUS = 8;

type ArcTool = AnnotationTool<PdfPolylineAnnoObject>;
type ArcTransform = NonNullable<ArcTool['transform']>;

export interface ArcControlPoints {
  start: Position;
  end: Position;
  through: Position;
}

export interface ArcGeometry extends ArcControlPoints {
  center: Position;
  radius: number;
  chordLength: number;
  startAngle: number;
  endAngle: number;
  controlAngle: number;
  sweepRadians: number;
  sweepDegrees: number;
  arcLength: number;
  clockwise: boolean;
  throughVertexIndex: number;
  points: Position[];
}

export interface ArcDecorationIds {
  label: string;
  startRadius: string;
  endRadius: string;
  angleArc: string;
}

export interface ArcAnnotationMetadata {
  measurementKind?: 'arc';
  arcGenerated?: boolean;
  arcControlPoints?: ArcControlPoints;
  arcThroughVertexIndex?: number;
  arcDecorationIds?: ArcDecorationIds;
  measurementDecorationFor?: string;
}

export interface ArcMeasurementDetails {
  annotationId: string;
  pageIndex: number;
  formattedLength: string;
  formattedRadius: string;
  formattedAngle: string;
  formattedChord: string;
  lengthValue: number;
  radiusValue: number;
  angleValue: number;
  chordValue: number;
  strokeColor: string;
  strokeWidth: number;
}

export function circularArcThroughPoints(
  start: Position,
  end: Position,
  through: Position
): ArcGeometry | null {
  if (![start, end, through].every(isFinitePoint)) {
    return null;
  }

  const startEnd = distance(start, end);
  const startThrough = distance(start, through);
  const endThrough = distance(end, through);
  const coordinateScale = Math.max(1, startEnd, startThrough, endThrough);
  const pointTolerance = Math.max(
    MINIMUM_ABSOLUTE_DISTANCE,
    coordinateScale * POINT_RELATIVE_TOLERANCE
  );
  if (Math.min(startEnd, startThrough, endThrough) <= pointTolerance) {
    return null;
  }

  const doubledArea = cross(start, end, through);
  if (Math.abs(doubledArea) <= coordinateScale ** 2 * COLLINEAR_RELATIVE_TOLERANCE) {
    return null;
  }

  const denominator = 2 * (
    start.x * (end.y - through.y)
    + end.x * (through.y - start.y)
    + through.x * (start.y - end.y)
  );
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= Number.EPSILON) {
    return null;
  }

  const startSquared = start.x ** 2 + start.y ** 2;
  const endSquared = end.x ** 2 + end.y ** 2;
  const throughSquared = through.x ** 2 + through.y ** 2;
  const center = {
    x: (
      startSquared * (end.y - through.y)
      + endSquared * (through.y - start.y)
      + throughSquared * (start.y - end.y)
    ) / denominator,
    y: (
      startSquared * (through.x - end.x)
      + endSquared * (start.x - through.x)
      + throughSquared * (end.x - start.x)
    ) / denominator
  };
  const radius = distance(start, center);
  if (!isFinitePoint(center) || !Number.isFinite(radius) || radius <= pointTolerance) {
    return null;
  }

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  const controlAngle = Math.atan2(through.y - center.y, through.x - center.x);
  const counterClockwiseEnd = normalizeRadians(endAngle - startAngle);
  const counterClockwiseThrough = normalizeRadians(controlAngle - startAngle);
  const sweepRadians = counterClockwiseThrough <= counterClockwiseEnd + 1e-10
    ? counterClockwiseEnd
    : -(FULL_CIRCLE - counterClockwiseEnd);
  if (!Number.isFinite(sweepRadians) || Math.abs(sweepRadians) <= Number.EPSILON) {
    return null;
  }

  const throughSweep = sweepRadians >= 0
    ? counterClockwiseThrough
    : -(FULL_CIRCLE - counterClockwiseThrough);
  const segmentCount = Math.max(
    MINIMUM_SEGMENTS,
    Math.ceil(Math.abs(sweepRadians) / FULL_CIRCLE * SEGMENTS_PER_CIRCLE)
  );
  const firstSegmentRatio = Math.abs(throughSweep / sweepRadians);
  const firstSegmentCount = Math.max(1, Math.min(
    segmentCount - 1,
    Math.round(segmentCount * firstSegmentRatio)
  ));
  const secondSegmentCount = segmentCount - firstSegmentCount;
  const firstPoints = sampleArc(center, radius, startAngle, throughSweep, firstSegmentCount);
  const secondPoints = sampleArc(
    center,
    radius,
    startAngle + throughSweep,
    sweepRadians - throughSweep,
    secondSegmentCount
  ).slice(1);
  const points = [...firstPoints, ...secondPoints];
  const throughVertexIndex = firstPoints.length - 1;
  points[0] = {...start};
  points[throughVertexIndex] = {...through};
  points[points.length - 1] = {...end};

  return {
    start: {...start},
    end: {...end},
    through: {...through},
    center,
    radius,
    chordLength: startEnd,
    startAngle,
    endAngle,
    controlAngle,
    sweepRadians,
    sweepDegrees: Math.abs(sweepRadians) * 180 / Math.PI,
    arcLength: Math.abs(sweepRadians) * radius,
    clockwise: sweepRadians < 0,
    throughVertexIndex,
    points
  };
}

export function arcGeometryFromAnnotation(annotation: PdfPolylineAnnoObject): ArcGeometry | null {
  const controlPoints = arcControlPoints(annotation);
  return controlPoints
    ? circularArcThroughPoints(controlPoints.start, controlPoints.end, controlPoints.through)
    : null;
}

export function arcControlPoints(
  annotationOrVertices: PdfPolylineAnnoObject | Position[]
): ArcControlPoints | null {
  const annotation = Array.isArray(annotationOrVertices) ? null : annotationOrVertices;
  const metadata = annotation?.custom as ArcAnnotationMetadata | undefined;
  if (metadata?.arcControlPoints && validControlPoints(metadata.arcControlPoints)) {
    return cloneControlPoints(metadata.arcControlPoints);
  }

  const vertices = Array.isArray(annotationOrVertices)
    ? annotationOrVertices
    : annotationOrVertices.vertices;
  const uniqueVertices = vertices.filter((point, index) => (
    index === 0 || distance(point, vertices[index - 1]) > MINIMUM_ABSOLUTE_DISTANCE
  ));
  if (uniqueVertices.length < 3) {
    return null;
  }

  const throughIndex = annotation
    ? arcThroughVertexIndex(annotation)
    : Math.floor((uniqueVertices.length - 1) / 2);
  return {
    start: {...uniqueVertices[0]},
    end: {...uniqueVertices[uniqueVertices.length - 1]},
    through: {...uniqueVertices[Math.min(throughIndex, uniqueVertices.length - 2)]}
  };
}

export function arcThroughVertexIndex(annotation: PdfPolylineAnnoObject): number {
  const metadata = annotation.custom as ArcAnnotationMetadata | undefined;
  const index = Number(metadata?.arcThroughVertexIndex);
  return Number.isInteger(index) && index > 0 && index < annotation.vertices.length - 1
    ? index
    : Math.floor((annotation.vertices.length - 1) / 2);
}

export function arcNeedsNormalization(annotation: PdfPolylineAnnoObject): boolean {
  const metadata = annotation.custom as ArcAnnotationMetadata | undefined;
  return metadata?.arcGenerated !== true || !metadata.arcControlPoints;
}

export function arcDecorationIds(annotationId: string): ArcDecorationIds {
  return {
    label: `${annotationId}-arc-measurement-label`,
    startRadius: `${annotationId}-arc-start-radius`,
    endRadius: `${annotationId}-arc-end-radius`,
    angleArc: `${annotationId}-arc-angle`
  };
}

export function arcAnnotationPatch(
  annotation: PdfPolylineAnnoObject,
  formattedLength: string,
  geometry = arcGeometryFromAnnotation(annotation),
  ids = arcDecorationIds(annotation.id)
): Partial<PdfPolylineAnnoObject> {
  if (!geometry) {
    return {};
  }
  return {
    contents: formattedLength,
    subject: 'Medição de arco',
    intent: 'MarkFlowArcMeasurement',
    custom: arcMetadata(annotation, geometry, ids)
  };
}

export function buildArcLabel(
  annotation: PdfPolylineAnnoObject,
  formattedLength: string,
  geometry = arcGeometryFromAnnotation(annotation),
  ids = arcDecorationIds(annotation.id)
): PdfFreeTextAnnoObject | null {
  if (!geometry) {
    return null;
  }

  const middleAngle = geometry.startAngle + geometry.sweepRadians / 2;
  const direction = {x: Math.cos(middleAngle), y: Math.sin(middleAngle)};
  const anchor = {
    x: geometry.center.x + direction.x * geometry.radius * LABEL_RADIUS_RATIO,
    y: geometry.center.y + direction.y * geometry.radius * LABEL_RADIUS_RATIO
  };
  const contents = formattedLength;
  const labelWidth = Math.max(MINIMUM_LABEL_WIDTH, contents.length * 6.2);
  const strokeColor = annotation.strokeColor || '#8b5cf6';

  return {
    id: ids.label,
    pageIndex: annotation.pageIndex,
    type: PdfAnnotationSubtype.FREETEXT,
    rect: {
      origin: {x: anchor.x - labelWidth / 2, y: anchor.y - LABEL_HEIGHT / 2},
      size: {width: labelWidth, height: LABEL_HEIGHT}
    },
    contents,
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
    author: annotation.author,
    subject: 'Valor da medição de arco',
    flags: ['print', 'readOnly', 'locked'],
    custom: {measurementDecorationFor: annotation.id} satisfies ArcAnnotationMetadata
  };
}

export function buildArcDecorations(
  annotation: PdfPolylineAnnoObject,
  formattedLength: string,
  geometry = arcGeometryFromAnnotation(annotation),
  ids = arcDecorationIds(annotation.id)
): Array<PdfLineAnnoObject | PdfPolylineAnnoObject | PdfFreeTextAnnoObject> {
  if (!geometry) {
    return [];
  }
  const label = buildArcLabel(annotation, formattedLength, geometry, ids);
  if (!label) {
    return [];
  }

  const decorationFlags: PdfLineAnnoObject['flags'] = ['print', 'readOnly', 'locked'];
  const common = {
    pageIndex: annotation.pageIndex,
    color: 'transparent',
    opacity: annotation.opacity ?? 1,
    strokeWidth: Math.max(0.75, annotation.strokeWidth || 1),
    strokeColor: annotation.strokeColor || '#8b5cf6',
    author: annotation.author,
    flags: decorationFlags,
    custom: {measurementDecorationFor: annotation.id} satisfies ArcAnnotationMetadata
  };
  const radiusLine = (id: string, end: Position): PdfLineAnnoObject => ({
    ...common,
    id,
    type: PdfAnnotationSubtype.LINE,
    rect: arcRect([geometry.center, end], common.strokeWidth),
    linePoints: {start: geometry.center, end},
    lineEndings: {start: PdfAnnotationLineEnding.None, end: PdfAnnotationLineEnding.None},
    strokeStyle: PdfAnnotationBorderStyle.DASHED,
    strokeDashArray: [4, 4],
    subject: 'Raio da medição de arco'
  });
  const innerRadius = Math.min(
    geometry.radius * 0.4,
    Math.max(MINIMUM_INNER_ARC_RADIUS, geometry.radius * INNER_ARC_RADIUS_RATIO)
  );
  const innerSegments = Math.max(8, Math.ceil(Math.abs(geometry.sweepRadians) / FULL_CIRCLE * 32));
  const innerPoints = sampleArc(
    geometry.center,
    innerRadius,
    geometry.startAngle,
    geometry.sweepRadians,
    innerSegments
  );
  const angleArc: PdfPolylineAnnoObject = {
    ...common,
    id: ids.angleArc,
    type: PdfAnnotationSubtype.POLYLINE,
    rect: arcRect(innerPoints, common.strokeWidth),
    vertices: innerPoints,
    lineEndings: {start: PdfAnnotationLineEnding.None, end: PdfAnnotationLineEnding.None},
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
    strokeDashArray: [],
    subject: 'Ângulo da medição de arco'
  };

  return [
    radiusLine(ids.startRadius, geometry.start),
    radiusLine(ids.endRadius, geometry.end),
    angleArc,
    label
  ];
}

export function createArcPointerHandler(): NonNullable<ArcTool['pointerHandler']> {
  return {
    annotationType: PdfAnnotationSubtype.POLYLINE,
    create(context) {
      let start: Position | null = null;
      let end: Position | null = null;

      const reset = () => {
        start = null;
        end = null;
        context.onPreview(null);
      };
      const clampToPage = (point: Position): Position => ({
        x: Math.max(0, Math.min(context.pageSize.width, point.x)),
        y: Math.max(0, Math.min(context.pageSize.height, point.y))
      });
      const defaults = () => {
        const tool = context.getTool();
        if (!tool) {
          return null;
        }
        return {
          ...tool.defaults,
          color: tool.defaults.color ?? 'transparent',
          opacity: tool.defaults.opacity ?? 1,
          strokeWidth: tool.defaults.strokeWidth ?? 1,
          strokeColor: tool.defaults.strokeColor ?? '#8b5cf6',
          strokeStyle: tool.defaults.strokeStyle ?? PdfAnnotationBorderStyle.SOLID,
          strokeDashArray: tool.defaults.strokeDashArray ?? [],
          lineEndings: tool.defaults.lineEndings ?? {
            start: PdfAnnotationLineEnding.None,
            end: PdfAnnotationLineEnding.None
          },
          flags: tool.defaults.flags ?? ['print']
        };
      };
      const preview = (cursor: Position) => {
        if (!start) {
          return;
        }
        const style = defaults();
        if (!style) {
          return;
        }
        const geometry = end ? circularArcThroughPoints(start, end, cursor) : null;
        const vertices = geometry?.points ?? (end ? [start, end, cursor] : [start, cursor]);
        const bounds = arcRect(vertices, Number(style.strokeWidth));
        context.onPreview({
          type: PdfAnnotationSubtype.POLYLINE,
          bounds,
          data: {
            ...style,
            rect: bounds,
            vertices,
            currentVertex: cursor
          }
        });
      };

      return {
        onClick: (point, event) => {
          if (event.metaKey || event.ctrlKey) {
            return;
          }
          const position = clampToPage(point);
          if (!start) {
            start = position;
            preview(position);
            return;
          }
          if (!end) {
            if (distance(start, position) <= MINIMUM_ABSOLUTE_DISTANCE) {
              return;
            }
            end = position;
            preview(position);
            return;
          }

          const geometry = circularArcThroughPoints(start, end, position);
          const style = defaults();
          if (!geometry || !style) {
            preview(position);
            return;
          }
          const annotation: PdfPolylineAnnoObject = {
            ...style,
            id: crypto.randomUUID(),
            pageIndex: context.pageIndex,
            type: PdfAnnotationSubtype.POLYLINE,
            rect: arcRect(geometry.points, Number(style.strokeWidth)),
            vertices: geometry.points,
            created: new Date(),
            subject: 'Medição de arco',
            intent: 'MarkFlowArcMeasurement',
            custom: arcMetadata(undefined, geometry)
          } as PdfPolylineAnnoObject;
          context.onCommit(annotation);
          reset();
        },
        onPointerMove: point => preview(clampToPage(point)),
        onDoubleClick: reset,
        onPointerCancel: reset,
        onHandlerActiveEnd: reset
      };
    }
  };
}

export function createArcTransform(baseTransform?: ArcTransform): ArcTransform {
  return (original, context) => {
    const basePatch = baseTransform ? baseTransform(original, context) : context.changes;
    if (context.type === 'property-update') {
      return basePatch;
    }

    const candidate = {...original, ...basePatch} as PdfPolylineAnnoObject;
    if (!candidate.vertices?.length) {
      return basePatch;
    }
    const throughIndex = Math.min(
      arcThroughVertexIndex(original),
      candidate.vertices.length - 2
    );
    const geometry = circularArcThroughPoints(
      candidate.vertices[0],
      candidate.vertices[candidate.vertices.length - 1],
      candidate.vertices[throughIndex]
    );
    if (!geometry) {
      return {};
    }

    const geometryPatch = context.type === 'vertex-edit' && baseTransform
      ? baseTransform(original, {
          ...context,
          changes: {...context.changes, vertices: geometry.points}
        })
      : basePatch;
    return {
      ...geometryPatch,
      vertices: geometry.points,
      custom: arcMetadata(original, geometry)
    };
  };
}

export function arcDetails(
  annotation: PdfPolylineAnnoObject,
  linearFactor: number,
  unit: string,
  precision: number
): ArcMeasurementDetails | null {
  const geometry = arcGeometryFromAnnotation(annotation);
  if (!geometry) {
    return null;
  }

  const length = geometry.arcLength * linearFactor;
  const radius = geometry.radius * linearFactor;
  const chord = geometry.chordLength * linearFactor;
  const format = (value: number) => value.toLocaleString('pt-BR', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  return {
    annotationId: annotation.id,
    pageIndex: annotation.pageIndex,
    formattedLength: `${format(length)} ${unit}`,
    formattedRadius: `${format(radius)} ${unit}`,
    formattedAngle: `${format(geometry.sweepDegrees)}°`,
    formattedChord: `${format(chord)} ${unit}`,
    lengthValue: length,
    radiusValue: radius,
    angleValue: geometry.sweepDegrees,
    chordValue: chord,
    strokeColor: annotation.strokeColor || '#8b5cf6',
    strokeWidth: annotation.strokeWidth || 1
  };
}

function arcMetadata(
  annotation: PdfPolylineAnnoObject | undefined,
  geometry: ArcGeometry,
  ids = annotation ? arcDecorationIds(annotation.id) : undefined
): ArcAnnotationMetadata {
  const existing = annotation?.custom ?? {};
  return {
    ...existing,
    measurementKind: 'arc',
    arcGenerated: true,
    arcControlPoints: {
      start: {...geometry.start},
      end: {...geometry.end},
      through: {...geometry.through}
    },
    arcThroughVertexIndex: geometry.throughVertexIndex,
    ...(ids ? {arcDecorationIds: ids} : {})
  };
}

function arcRect(points: Position[], strokeWidth: number): Rect {
  const padding = Math.max(1, strokeWidth / 2);
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const left = Math.min(...xs) - padding;
  const top = Math.min(...ys) - padding;
  const right = Math.max(...xs) + padding;
  const bottom = Math.max(...ys) + padding;
  return {
    origin: {x: left, y: top},
    size: {width: right - left, height: bottom - top}
  };
}

function sampleArc(
  center: Position,
  radius: number,
  startAngle: number,
  sweep: number,
  segments: number
): Position[] {
  return Array.from({length: segments + 1}, (_, index) => {
    const angle = startAngle + sweep * index / segments;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

function validControlPoints(points: ArcControlPoints): boolean {
  return [points.start, points.end, points.through].every(isFinitePoint);
}

function cloneControlPoints(points: ArcControlPoints): ArcControlPoints {
  return {
    start: {...points.start},
    end: {...points.end},
    through: {...points.through}
  };
}

function isFinitePoint(point: Position | undefined): point is Position {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function distance(left: Position, right: Position): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function cross(start: Position, end: Position, through: Position): number {
  return (end.x - start.x) * (through.y - start.y)
    - (end.y - start.y) * (through.x - start.x);
}

function normalizeRadians(value: number): number {
  return (value % FULL_CIRCLE + FULL_CIRCLE) % FULL_CIRCLE;
}
