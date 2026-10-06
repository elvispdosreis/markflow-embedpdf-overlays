import {
  type AnnotationTool,
  type AnnotationCapability,
  PdfAnnotationLineEnding,
  PdfAnnotationSubtype,
  type PdfAnnotationObject
} from '@embedpdf/snippet';
import {describe, expect, it, vi} from 'vitest';
import {
  createMeasurementTool,
  registerMeasurementTools,
  isMeasurementAnnotation,
  measurementKindFromAnnotation,
  MEASUREMENT_TOOL_IDS
} from './measurement-tools';
import {createSegmentAnglePointerHandler} from './segment-angle-measurement';

const baseLineTool = {
  id: 'line',
  name: 'Linha',
  categories: ['shape'],
  matchScore: () => 5,
  defaults: {
    type: PdfAnnotationSubtype.LINE,
    strokeWidth: 4,
    strokeColor: '#111827',
    custom: {shapeSetting: 'preservado'}
  },
  interaction: {exclusive: false}
} as AnnotationTool;

describe('measurement tools', () => {
  it('registers each custom tool once across repeated initialization', () => {
    const tools = new Map<string, AnnotationTool>([['line', baseLineTool]]);
    const addTool = vi.fn((tool: AnnotationTool) => tools.set(tool.id, tool));
    const annotation = {getTool: (id: string) => tools.get(id), addTool} as unknown as AnnotationCapability;
    const definitions = [{toolId: 'measure-distance', baseToolId: 'line', kind: 'distance' as const, label: 'Distância'}];
    registerMeasurementTools(annotation, definitions);
    registerMeasurementTools(annotation, definitions);
    expect(addTool).toHaveBeenCalledOnce();
    expect(tools.get('measure-distance')?.defaults.custom).toMatchObject({measurementKind: 'distance'});
  });

  it('reports the missing base tool before registering an invalid custom tool', () => {
    const addTool = vi.fn();
    const annotation = {getTool: () => undefined, addTool} as unknown as AnnotationCapability;
    expect(() => registerMeasurementTools(annotation, [
      {toolId: 'measure-distance', baseToolId: 'line', kind: 'distance', label: 'Distância'}
    ])).toThrow('Ferramenta base line indisponível.');
    expect(addTool).not.toHaveBeenCalled();
  });

  it('cria uma ferramenta de distância independente da linha de Shapes', () => {
    const measurementTool = createMeasurementTool(baseLineTool, {
      kind: 'distance',
      label: 'Distância',
      toolId: MEASUREMENT_TOOL_IDS.distance,
      baseToolId: 'line'
    });
    const measurementDefaults = measurementTool.defaults as Record<string, unknown>;
    const shapeDefaults = baseLineTool.defaults as Record<string, unknown>;

    expect(measurementTool.id).toBe('measure-distance');
    expect(measurementTool.categories).toEqual(['measure']);
    expect(measurementTool.pointerHandler?.annotationType).toBe(PdfAnnotationSubtype.LINE);
    expect(measurementDefaults['strokeWidth']).toBe(1);
    expect(measurementDefaults['lineEndings']).toEqual({
      start: PdfAnnotationLineEnding.ClosedArrow,
      end: PdfAnnotationLineEnding.ClosedArrow
    });
    expect(measurementDefaults['custom']).toEqual({
      shapeSetting: 'preservado',
      measurementKind: 'distance'
    });

    expect(baseLineTool.id).toBe('line');
    expect(shapeDefaults['strokeWidth']).toBe(4);
    expect(shapeDefaults['custom']).toEqual({shapeSetting: 'preservado'});
  });

  it('associa somente anotações marcadas ao respectivo Measure', () => {
    const standardShape = {
      type: PdfAnnotationSubtype.LINE,
      custom: {shapeSetting: 'preservado'}
    } as PdfAnnotationObject;
    const distance = {
      type: PdfAnnotationSubtype.LINE,
      custom: {measurementKind: 'distance'}
    } as PdfAnnotationObject;

    expect(measurementKindFromAnnotation(standardShape)).toBeNull();
    expect(isMeasurementAnnotation(standardShape)).toBe(false);
    expect(isMeasurementAnnotation(distance, 'distance')).toBe(true);
    expect(isMeasurementAnnotation(distance, 'perimeter')).toBe(false);
  });

  it.each([
    ['rectangle-area', 'square', PdfAnnotationSubtype.SQUARE],
    ['ellipse', 'circle', PdfAnnotationSubtype.CIRCLE]
  ] as const)('adiciona a restrição com Shift somente à medição %s', (kind, baseId, subtype) => {
    const basePointerHandler = {
      annotationType: subtype,
      create: () => ({})
    } as NonNullable<AnnotationTool['pointerHandler']>;
    const baseTool = {
      ...baseLineTool,
      id: baseId,
      defaults: {...baseLineTool.defaults, type: subtype},
      pointerHandler: basePointerHandler
    } as AnnotationTool;

    const measurementTool = createMeasurementTool(baseTool, {
      kind,
      label: kind === 'ellipse' ? 'Elipse' : 'Área retangular',
      toolId: MEASUREMENT_TOOL_IDS[kind],
      baseToolId: baseId
    });

    expect(measurementTool.pointerHandler).not.toBe(basePointerHandler);
    expect(measurementTool.pointerHandler?.annotationType).toBe(subtype);
    expect(baseTool.pointerHandler).toBe(basePointerHandler);
  });

  it.each([
    ['perimeter', 'polyline', PdfAnnotationSubtype.POLYLINE],
    ['area', 'polygon', PdfAnnotationSubtype.POLYGON]
  ] as const)('restringe cada novo segmento de %s ao múltiplo de 22,5° mais próximo com Shift', (kind, baseId, subtype) => {
    const clicked: Array<{x: number; y: number}> = [];
    const moved: Array<{x: number; y: number}> = [];
    const basePointerHandler = {
      annotationType: subtype,
      create: () => ({
        onClick: (point: {x: number; y: number}) => clicked.push(point),
        onPointerMove: (point: {x: number; y: number}) => moved.push(point)
      })
    } as NonNullable<AnnotationTool['pointerHandler']>;
    const baseTool = {
      ...baseLineTool,
      id: baseId,
      defaults: {...baseLineTool.defaults, type: subtype},
      pointerHandler: basePointerHandler
    } as AnnotationTool;
    const measurementTool = createMeasurementTool(baseTool, {
      kind,
      label: kind === 'area' ? 'Área' : 'Perímetro',
      toolId: MEASUREMENT_TOOL_IDS[kind],
      baseToolId: baseId
    });
    const handler = measurementTool.pointerHandler!.create({pageSize: {width: 500, height: 500}, scale: 1} as never);
    const plainEvent = {shiftKey: false, ctrlKey: false, metaKey: false} as never;
    const shiftEvent = {shiftKey: true, ctrlKey: false, metaKey: false} as never;

    handler.onClick?.({x: 100, y: 100}, plainEvent, measurementTool.id);
    handler.onPointerMove?.({x: 150, y: 130}, shiftEvent, measurementTool.id);
    handler.onClick?.({x: 150, y: 130}, shiftEvent, measurementTool.id);
    handler.onPointerMove?.({x: 160, y: 165}, plainEvent, measurementTool.id);

    for (const point of [moved[0], clicked[1]]) {
      const angle = Math.atan2(point.y - 100, point.x - 100) * 180 / Math.PI;
      expect(angle).toBeCloseTo(22.5, 6);
    }
    expect(moved[1]).toEqual({x: 160, y: 165});
  });

  it('reinicia a restrição depois de fechar a área no primeiro vértice', () => {
    const forwarded: Array<{x: number; y: number}> = [];
    const basePointerHandler = {
      annotationType: PdfAnnotationSubtype.POLYGON,
      create: (context: {onCommit(annotation: PdfAnnotationObject): void}) => {
        let vertices: Array<{x: number; y: number}> = [];
        return {onClick: (point: {x: number; y: number}) => {
          forwarded.push(point);
          const first = vertices[0];
          if (vertices.length >= 3 && Math.abs(point.x - first.x) < 7 && Math.abs(point.y - first.y) < 7) {
            context.onCommit({} as PdfAnnotationObject);
            vertices = [];
          } else {
            vertices.push(point);
          }
        }};
      }
    } as NonNullable<AnnotationTool['pointerHandler']>;
    const handler = createSegmentAnglePointerHandler(basePointerHandler).create({
      pageSize: {width: 500, height: 500}, scale: 1, onCommit: () => undefined
    } as never);
    const plainEvent = {shiftKey: false, ctrlKey: false, metaKey: false} as never;
    const shiftEvent = {shiftKey: true, ctrlKey: false, metaKey: false} as never;

    handler.onClick?.({x: 100, y: 100}, plainEvent, 'measure-area');
    handler.onClick?.({x: 160, y: 100}, plainEvent, 'measure-area');
    handler.onClick?.({x: 160, y: 160}, plainEvent, 'measure-area');
    handler.onClick?.({x: 101, y: 101}, shiftEvent, 'measure-area');
    handler.onClick?.({x: 200, y: 180}, shiftEvent, 'measure-area');

    expect(forwarded.at(-1)).toEqual({x: 200, y: 180});
  });

  it('cria a ferramenta de arco sem alterar a polilinha de Shapes', () => {
    const basePolyline = {
      ...baseLineTool,
      id: 'polyline',
      name: 'Polilinha',
      defaults: {
        ...baseLineTool.defaults,
        type: PdfAnnotationSubtype.POLYLINE,
        strokeColor: '#111827'
      }
    } as AnnotationTool;
    const arcTool = createMeasurementTool(basePolyline, {
      kind: 'arc',
      label: 'Arco',
      toolId: MEASUREMENT_TOOL_IDS.arc,
      baseToolId: 'polyline'
    });

    expect(arcTool.id).toBe('measure-arc');
    expect(arcTool.defaults).toMatchObject({
      strokeWidth: 1,
      strokeColor: '#ef4444',
      custom: {shapeSetting: 'preservado', measurementKind: 'arc'}
    });
    expect(arcTool.pointerHandler?.annotationType).toBe(PdfAnnotationSubtype.POLYLINE);
    expect(arcTool.interaction.isResizable).toBe(false);
    expect(arcTool.interaction.isGroupResizable).toBe(false);
    expect(basePolyline.id).toBe('polyline');
    expect(basePolyline.defaults).toMatchObject({strokeWidth: 4, strokeColor: '#111827'});
  });
});
