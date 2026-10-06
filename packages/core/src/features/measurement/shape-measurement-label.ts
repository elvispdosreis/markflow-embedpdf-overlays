import {
  PdfAnnotationSubtype,
  type PdfAnnotationObject,
  type PdfCircleAnnoObject,
  type PdfFreeTextAnnoObject,
  type PdfPolygonAnnoObject,
  type PdfSquareAnnoObject,
  type Position,
  type Rect
} from '@embedpdf/snippet';

const LABEL_HEIGHT = 14;
const MINIMUM_LABEL_WIDTH = 40;
const LABEL_INSET = 4;

export interface ShapeMeasurementDecorationIds {
  label: string;
}

export interface ShapeMeasurementMetadata {
  measurementKind?: 'area' | 'rectangle-area' | 'ellipse';
  measurementDecorationFor?: string;
  measurementDecorationIds?: ShapeMeasurementDecorationIds;
}

export type ShapeMeasurementAnnotation = PdfPolygonAnnoObject | PdfSquareAnnoObject | PdfCircleAnnoObject;

export function isShapeMeasurementAnnotation(annotation: PdfAnnotationObject): annotation is ShapeMeasurementAnnotation {
  const kind = (annotation.custom as ShapeMeasurementMetadata | undefined)?.measurementKind;
  return (kind === 'area' && annotation.type === PdfAnnotationSubtype.POLYGON)
    || (kind === 'rectangle-area' && annotation.type === PdfAnnotationSubtype.SQUARE)
    || (kind === 'ellipse' && annotation.type === PdfAnnotationSubtype.CIRCLE);
}

export function shapeMeasurementDecorationIds(annotationId: string): ShapeMeasurementDecorationIds {
  return {label: `${annotationId}-shape-measurement-label`};
}

export function shapeMeasurementNeedsLabel(
  annotation: ShapeMeasurementAnnotation,
  formattedValue: string,
  ids = shapeMeasurementDecorationIds(annotation.id)
): boolean {
  const metadata = annotation.custom as ShapeMeasurementMetadata | undefined;
  return annotation.contents !== formattedValue || metadata?.measurementDecorationIds?.label !== ids.label;
}

export function shapeMeasurementPatch(
  annotation: ShapeMeasurementAnnotation,
  formattedValue: string,
  ids = shapeMeasurementDecorationIds(annotation.id)
): Partial<ShapeMeasurementAnnotation> {
  return {
    contents: formattedValue,
    custom: {
      ...(annotation.custom ?? {}),
      measurementDecorationIds: ids
    }
  } as Partial<ShapeMeasurementAnnotation>;
}

export function buildShapeMeasurementLabel(
  annotation: ShapeMeasurementAnnotation,
  formattedValue: string,
  ids = shapeMeasurementDecorationIds(annotation.id)
): PdfFreeTextAnnoObject {
  const bounds = annotation.rect;
  const center = annotation.type === PdfAnnotationSubtype.POLYGON
    ? polygonCentroid(annotation.vertices, bounds)
    : rectCenter(bounds);
  const availableWidth = Math.max(16, bounds.size.width - LABEL_INSET * 2);
  const availableHeight = Math.max(8, bounds.size.height - LABEL_INSET * 2);
  const width = Math.min(Math.max(MINIMUM_LABEL_WIDTH, formattedValue.length * 6.2), availableWidth);
  const height = Math.min(LABEL_HEIGHT, availableHeight);
  const anchor = clampLabelCenter(center, bounds, width, height);
  const strokeColor = annotation.strokeColor || '#ef4444';

  return {
    id: ids.label,
    pageIndex: annotation.pageIndex,
    type: PdfAnnotationSubtype.FREETEXT,
    rect: {
      origin: {x: anchor.x - width / 2, y: anchor.y - height / 2},
      size: {width, height}
    },
    contents: formattedValue,
    fontFamily: 5 as PdfFreeTextAnnoObject['fontFamily'],
    fontSize: Math.max(6, Math.min(10, height - 2)),
    fontColor: strokeColor,
    textAlign: 1 as PdfFreeTextAnnoObject['textAlign'],
    verticalAlign: 1 as PdfFreeTextAnnoObject['verticalAlign'],
    opacity: 1,
    color: 'transparent',
    backgroundColor: 'transparent',
    strokeColor,
    strokeWidth: 0,
    author: annotation.author,
    subject: 'Valor da medição',
    flags: ['print', 'readOnly', 'locked'],
    custom: {measurementDecorationFor: annotation.id} satisfies ShapeMeasurementMetadata
  };
}

function polygonCentroid(vertices: Position[], fallbackBounds: Rect): Position {
  if (vertices.length < 3) return rectCenter(fallbackBounds);
  let doubledArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < vertices.length; index++) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const cross = current.x * next.y - next.x * current.y;
    doubledArea += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }
  if (Math.abs(doubledArea) < 1e-8) return rectCenter(fallbackBounds);
  return {x: x / (3 * doubledArea), y: y / (3 * doubledArea)};
}

function rectCenter(rect: Rect): Position {
  return {
    x: rect.origin.x + rect.size.width / 2,
    y: rect.origin.y + rect.size.height / 2
  };
}

function clampLabelCenter(center: Position, bounds: Rect, width: number, height: number): Position {
  const minimumX = bounds.origin.x + width / 2;
  const maximumX = bounds.origin.x + bounds.size.width - width / 2;
  const minimumY = bounds.origin.y + height / 2;
  const maximumY = bounds.origin.y + bounds.size.height - height / 2;
  return {
    x: Math.max(minimumX, Math.min(maximumX, center.x)),
    y: Math.max(minimumY, Math.min(maximumY, center.y))
  };
}
