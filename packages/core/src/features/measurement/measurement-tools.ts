import {
  type AnnotationCapability,
  type AnnotationTool,
  PdfAnnotationLineEnding,
  PdfAnnotationSubtype,
  type PdfLineAnnoObject,
  type PdfAnnotationObject
} from '@embedpdf/snippet';
import {createArcPointerHandler, createArcTransform} from './arc-measurement';
import {createDistancePointerHandler, createDistanceTransform} from './distance-measurement';
import type {MeasurementKind} from './measurement.models';
import {createSegmentAnglePointerHandler} from './segment-angle-measurement';
import {createAspectRatioPointerHandler} from './shape-measurement';

export type SupportedMeasurementKind = MeasurementKind;

export interface MeasurementAnnotationMetadata {
  measurementKind?: SupportedMeasurementKind;
}

export interface MeasurementToolDefinition {
  kind: SupportedMeasurementKind;
  label: string;
  toolId: string;
  baseToolId: string;
}

/** Register custom tools once, keeping base-tool configuration and behavior. */
export function registerMeasurementTools(annotation: AnnotationCapability, definitions: readonly MeasurementToolDefinition[]): void {
  for (const definition of definitions) {
    if (annotation.getTool(definition.toolId)) continue;
    const baseTool = annotation.getTool(definition.baseToolId) as AnnotationTool | undefined;
    if (!baseTool) throw new Error(`Ferramenta base ${definition.baseToolId} indisponível.`);
    annotation.addTool(createMeasurementTool(baseTool, definition));
  }
}

export const MEASUREMENT_TOOL_IDS: Record<SupportedMeasurementKind, string> = {
  distance: 'measure-distance',
  perimeter: 'measure-perimeter',
  area: 'measure-area',
  'rectangle-area': 'measure-rectangle-area',
  ellipse: 'measure-ellipse',
  arc: 'measure-arc'
};

const MEASUREMENT_KINDS = new Set<SupportedMeasurementKind>([
  'distance',
  'perimeter',
  'area',
  'rectangle-area',
  'ellipse',
  'arc'
]);

export function measurementKindFromAnnotation(annotation: PdfAnnotationObject): SupportedMeasurementKind | null {
  const kind = (annotation.custom as MeasurementAnnotationMetadata | undefined)?.measurementKind;
  if (kind && MEASUREMENT_KINDS.has(kind)) {
    return kind;
  }
  if (annotation.type === PdfAnnotationSubtype.POLYLINE && annotation.intent === 'MarkFlowArcMeasurement') {
    return 'arc';
  }
  if (annotation.type === PdfAnnotationSubtype.LINE && annotation.intent === 'LineDimension') {
    return 'distance';
  }
  return null;
}

export function isMeasurementAnnotation(
  annotation: PdfAnnotationObject,
  expectedKind?: SupportedMeasurementKind
): boolean {
  const kind = measurementKindFromAnnotation(annotation);
  return expectedKind ? kind === expectedKind : kind !== null;
}

export function createMeasurementTool(
  baseTool: AnnotationTool,
  definition: MeasurementToolDefinition
): AnnotationTool {
  const defaults = baseTool.defaults as Partial<PdfAnnotationObject> & {
    custom?: Record<string, unknown>;
  };
  const measurementDefaults: Partial<PdfAnnotationObject> & Record<string, unknown> = {
    ...defaults,
    strokeWidth: 1,
    custom: {
      ...(defaults.custom ?? {}),
      measurementKind: definition.kind
    }
  };
  const constrainsAspectRatio = definition.kind === 'rectangle-area' || definition.kind === 'ellipse';
  const constrainsSegmentAngle = definition.kind === 'perimeter' || definition.kind === 'area';

  if (definition.kind === 'distance') {
    Object.assign(measurementDefaults, {
      intent: 'LineDimension',
      strokeColor: '#ef4444',
      lineEndings: {
        start: PdfAnnotationLineEnding.ClosedArrow,
        end: PdfAnnotationLineEnding.ClosedArrow
      }
    });
  }

  if (definition.kind === 'arc') {
    Object.assign(measurementDefaults, {
      intent: 'MarkFlowArcMeasurement',
      subject: 'Medição de arco',
      strokeColor: '#ef4444'
    });
  }

  return {
    ...baseTool,
    id: definition.toolId,
    name: definition.label,
    labelKey: undefined,
    categories: ['measure'],
    defaults: measurementDefaults,
    behavior: {
      ...baseTool.behavior,
      selectAfterCreate: true
    },
    ...(definition.kind === 'distance' ? {
      pointerHandler: createDistancePointerHandler(),
      transform: createDistanceTransform(baseTool.transform as AnnotationTool<PdfLineAnnoObject>['transform'])
    } : {}),
    ...(constrainsAspectRatio && baseTool.pointerHandler ? {
      pointerHandler: createAspectRatioPointerHandler(baseTool.pointerHandler)
    } : {}),
    ...(constrainsSegmentAngle && baseTool.pointerHandler ? {
      pointerHandler: createSegmentAnglePointerHandler(baseTool.pointerHandler)
    } : {}),
    ...(definition.kind === 'arc' ? {
      interaction: {
        ...baseTool.interaction,
        isResizable: false,
        isRotatable: false,
        isGroupResizable: false,
        isGroupRotatable: false
      },
      pointerHandler: createArcPointerHandler(),
      transform: createArcTransform(baseTool.transform as never)
    } : {}),
    matchScore: annotation => isMeasurementAnnotation(annotation, definition.kind) ? 100 : 0
  } as AnnotationTool;
}
