import {
  PdfAnnotationSubtype,
  type PdfAnnotationObject,
  type PdfFreeTextAnnoObject,
  type PdfPolylineAnnoObject,
  type Position
} from '@embedpdf/snippet';

const LABEL_HEIGHT = 14;
const MINIMUM_LABEL_WIDTH = 40;

export interface PerimeterMeasurementDecorationIds {
  label: string;
}

interface PerimeterMeasurementMetadata {
  measurementKind?: 'perimeter';
  measurementDecorationFor?: string;
  measurementDecorationIds?: PerimeterMeasurementDecorationIds;
}

export function isPerimeterMeasurementAnnotation(
  annotation: PdfAnnotationObject
): annotation is PdfPolylineAnnoObject {
  return annotation.type === PdfAnnotationSubtype.POLYLINE
    && (annotation.custom as PerimeterMeasurementMetadata | undefined)?.measurementKind === 'perimeter';
}

export function perimeterMeasurementLabelIds(annotationId: string): PerimeterMeasurementDecorationIds {
  return {label: `${annotationId}-perimeter-measurement-label`};
}

export function perimeterMeasurementPatch(
  annotation: PdfPolylineAnnoObject,
  formattedValue: string,
  ids = perimeterMeasurementLabelIds(annotation.id)
): Partial<PdfPolylineAnnoObject> {
  return {
    contents: formattedValue,
    subject: 'Medição de perímetro',
    custom: {
      ...(annotation.custom ?? {}),
      measurementKind: 'perimeter',
      measurementDecorationIds: ids
    } satisfies PerimeterMeasurementMetadata
  };
}

export function perimeterMeasurementNeedsLabel(
  annotation: PdfPolylineAnnoObject,
  formattedValue: string,
  ids = perimeterMeasurementLabelIds(annotation.id)
): boolean {
  const metadata = annotation.custom as PerimeterMeasurementMetadata | undefined;
  return annotation.contents !== formattedValue || metadata?.measurementDecorationIds?.label !== ids.label;
}

export function buildPerimeterMeasurementLabel(
  annotation: PdfPolylineAnnoObject,
  formattedValue: string,
  ids = perimeterMeasurementLabelIds(annotation.id)
): PdfFreeTextAnnoObject {
  const center = pathMidpoint(annotation.vertices);
  const width = Math.max(MINIMUM_LABEL_WIDTH, formattedValue.length * 6.2);
  const strokeColor = annotation.strokeColor || '#ef4444';

  return {
    id: ids.label,
    pageIndex: annotation.pageIndex,
    type: PdfAnnotationSubtype.FREETEXT,
    rect: {
      origin: {x: center.x - width / 2, y: center.y - LABEL_HEIGHT / 2},
      size: {width, height: LABEL_HEIGHT}
    },
    contents: formattedValue,
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
    subject: 'Valor da medição de perímetro',
    flags: ['print', 'readOnly', 'locked'],
    custom: {measurementDecorationFor: annotation.id} satisfies PerimeterMeasurementMetadata
  };
}

function pathMidpoint(vertices: Position[]): Position {
  if (vertices.length === 0) return {x: 0, y: 0};
  if (vertices.length === 1) return vertices[0];
  const lengths = vertices.slice(1).map((point, index) => Math.hypot(
    point.x - vertices[index].x,
    point.y - vertices[index].y
  ));
  const target = lengths.reduce((sum, length) => sum + length, 0) / 2;
  let traversed = 0;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (traversed + length >= target && length > 0) {
      const ratio = (target - traversed) / length;
      return {
        x: vertices[index].x + (vertices[index + 1].x - vertices[index].x) * ratio,
        y: vertices[index].y + (vertices[index + 1].y - vertices[index].y) * ratio
      };
    }
    traversed += length;
  }
  return vertices.at(-1)!;
}
