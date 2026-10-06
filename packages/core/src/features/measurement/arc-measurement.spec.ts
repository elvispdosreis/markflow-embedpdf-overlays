import {
  PdfAnnotationBorderStyle,
  PdfAnnotationSubtype,
  type PdfLineAnnoObject,
  type PdfFreeTextAnnoObject,
  type PdfPolylineAnnoObject
} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {
  arcAnnotationPatch,
  arcControlPoints,
  arcDecorationIds,
  arcDetails,
  buildArcDecorations,
  circularArcThroughPoints,
  createArcPointerHandler,
  createArcTransform
} from './arc-measurement';

function annotation(vertices: Array<{x: number; y: number}>): PdfPolylineAnnoObject {
  return {
    id: 'arc-1',
    pageIndex: 0,
    type: PdfAnnotationSubtype.POLYLINE,
    rect: {origin: {x: -1, y: 0}, size: {width: 2, height: 1}},
    vertices,
    color: 'transparent',
    opacity: 1,
    strokeWidth: 1,
    strokeColor: '#8b5cf6',
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
    custom: {measurementKind: 'arc'}
  };
}

describe('arc measurement', () => {
  it('calcula um semicírculo pelos três pontos de controle', () => {
    const geometry = circularArcThroughPoints(
      {x: 1, y: 0},
      {x: -1, y: 0},
      {x: 0, y: 1}
    );

    expect(geometry).not.toBeNull();
    expect(geometry?.center.x).toBeCloseTo(0, 10);
    expect(geometry?.center.y).toBeCloseTo(0, 10);
    expect(geometry?.radius).toBeCloseTo(1, 10);
    expect(geometry?.sweepDegrees).toBeCloseTo(180, 10);
    expect(geometry?.arcLength).toBeCloseTo(Math.PI, 10);
    expect(geometry?.chordLength).toBeCloseTo(2, 10);
    expect(geometry?.points.length).toBeGreaterThan(20);
  });

  it('preserva o sentido do arco indicado pelo ponto intermediário', () => {
    const geometry = circularArcThroughPoints(
      {x: 1, y: 0},
      {x: -1, y: 0},
      {x: 0, y: -1}
    );

    expect(geometry?.sweepRadians).toBeLessThan(0);
    expect(geometry?.sweepDegrees).toBeCloseTo(180, 10);
  });

  it('recusa três pontos alinhados', () => {
    expect(circularArcThroughPoints(
      {x: 0, y: 0},
      {x: 1, y: 1},
      {x: 2, y: 2}
    )).toBeNull();
  });

  it('recusa pontos coincidentes e praticamente alinhados', () => {
    expect(circularArcThroughPoints(
      {x: 0, y: 0},
      {x: 0, y: 0},
      {x: 1, y: 1}
    )).toBeNull();
    expect(circularArcThroughPoints(
      {x: 0, y: 0},
      {x: 1_000, y: 0},
      {x: 500, y: 0.0001}
    )).toBeNull();
  });

  it('seleciona o arco maior quando P3 está fora do caminho menor', () => {
    const angle = 20 * Math.PI / 180;
    const geometry = circularArcThroughPoints(
      {x: 1, y: 0},
      {x: Math.cos(angle), y: Math.sin(angle)},
      {x: -1, y: 0}
    );

    expect(geometry?.sweepDegrees).toBeCloseTo(340, 10);
    expect(geometry?.arcLength).toBeCloseTo(340 * Math.PI / 180, 10);
    expect(geometry?.points[geometry.throughVertexIndex]).toEqual({x: -1, y: 0});
  });

  it('recupera os controles de um arco amostrado', () => {
    const geometry = circularArcThroughPoints(
      {x: 1, y: 0},
      {x: -1, y: 0},
      {x: 0, y: 1}
    );
    const controls = arcControlPoints(geometry?.points ?? []);

    expect(controls?.start).toEqual({x: 1, y: 0});
    expect(controls?.end).toEqual({x: -1, y: 0});
    expect(controls?.through.x).toBeCloseTo(0, 10);
    expect(controls?.through.y).toBeCloseTo(1, 10);
  });

  it('formata os detalhes e identifica a anotação como arco', () => {
    const arc = annotation([{x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}]);
    const details = arcDetails(arc, 2, 'm', 2);
    const patch = arcAnnotationPatch(arc, '6,28 m');

    expect(details?.lengthValue).toBeCloseTo(Math.PI * 2, 10);
    expect(details?.radiusValue).toBeCloseTo(2, 10);
    expect(details?.angleValue).toBeCloseTo(180, 10);
    expect(details?.chordValue).toBeCloseTo(4, 10);
    expect(details?.formattedLength).toBe('6,28 m');
    expect(patch).toMatchObject({
      contents: '6,28 m',
      subject: 'Medição de arco',
      custom: {measurementKind: 'arc', arcGenerated: true}
    });
  });

  it('cria o label interno, os raios tracejados e o arco central da medição', () => {
    const arc = annotation([{x: 100, y: 50}, {x: 50, y: 100}, {x: 0, y: 50}]);
    arc.rect = {origin: {x: 0, y: 50}, size: {width: 100, height: 50}};
    const geometry = circularArcThroughPoints(
      {x: 100, y: 50},
      {x: 0, y: 50},
      {x: 50, y: 100}
    )!;
    const ids = arcDecorationIds(arc.id);
    const decorations = buildArcDecorations(arc, '157,08 m', geometry, ids);

    expect(decorations.map(item => item.id)).toEqual([
      ids.startRadius,
      ids.endRadius,
      ids.angleArc,
      ids.label
    ]);
    const [startRadius, endRadius, angleArc] = decorations;
    const label = decorations[3] as PdfFreeTextAnnoObject;
    expect(startRadius.type).toBe(PdfAnnotationSubtype.LINE);
    expect(endRadius.type).toBe(PdfAnnotationSubtype.LINE);
    expect((startRadius as PdfLineAnnoObject).strokeStyle).toBe(PdfAnnotationBorderStyle.DASHED);
    expect(angleArc.type).toBe(PdfAnnotationSubtype.POLYLINE);
    expect(label.type).toBe(PdfAnnotationSubtype.FREETEXT);
    expect(label.contents).toBe('157,08 m');
    expect(label.fontSize).toBe(10);
    expect(label.fontColor).toBe('#8b5cf6');
    expect(label.strokeColor).toBe(label.fontColor);
    expect(label.strokeWidth).toBe(0);
    expect(label.color).toBe('transparent');
    expect(label.flags).toEqual(['print', 'readOnly', 'locked']);
    const labelCenter = {
      x: label.rect.origin.x + label.rect.size.width / 2,
      y: label.rect.origin.y + label.rect.size.height / 2
    };
    expect(Math.hypot(labelCenter.x - geometry.center.x, labelCenter.y - geometry.center.y))
      .toBeLessThan(geometry.radius);
    expect(label.custom).toEqual({measurementDecorationFor: arc.id});
  });

  it('cria no terceiro clique e mostra um preview circular depois de P2', () => {
    const previews: unknown[] = [];
    const commits: PdfPolylineAnnoObject[] = [];
    const factory = createArcPointerHandler();
    const handler = factory.create({
      pageIndex: 0,
      pageSize: {width: 100, height: 100},
      pageRotation: 0,
      scale: 1,
      services: {requestFile: () => undefined},
      getTool: () => ({
        defaults: annotation([]),
      }),
      getToolContext: () => undefined,
      onPreview: (preview: any) => previews.push(preview),
      onCommit: (arc: any) => commits.push(arc)
    } as never);
    const event = {metaKey: false, ctrlKey: false} as never;

    handler.onClick?.({x: 10, y: 20}, event, 'measure-arc');
    handler.onClick?.({x: 50, y: 20}, event, 'measure-arc');
    handler.onPointerMove?.({x: 30, y: 40}, event, 'measure-arc');

    const preview = previews.at(-1) as {data?: {vertices?: unknown[]}};
    expect(preview.data?.vertices?.length).toBeGreaterThan(12);
    expect(commits).toHaveLength(0);

    handler.onClick?.({x: 30, y: 40}, event, 'measure-arc');
    expect(commits).toHaveLength(1);
    expect(commits[0].custom).toMatchObject({
      measurementKind: 'arc',
      arcControlPoints: {
        start: {x: 10, y: 20},
        end: {x: 50, y: 20},
        through: {x: 30, y: 40}
      }
    });
  });

  it('não finaliza uma criação colinear', () => {
    const commits: PdfPolylineAnnoObject[] = [];
    const handler = createArcPointerHandler().create({
      pageIndex: 0,
      pageSize: {width: 100, height: 100},
      pageRotation: 0,
      scale: 1,
      services: {requestFile: () => undefined},
      getTool: () => ({defaults: annotation([])}),
      getToolContext: () => undefined,
      onPreview: () => undefined,
      onCommit: (arc: any) => commits.push(arc)
    } as never);
    const event = {metaKey: false, ctrlKey: false} as never;

    handler.onClick?.({x: 10, y: 10}, event, 'measure-arc');
    handler.onClick?.({x: 50, y: 10}, event, 'measure-arc');
    handler.onClick?.({x: 30, y: 10}, event, 'measure-arc');

    expect(commits).toHaveLength(0);
  });

  it('recalcula os vértices ao editar P3', () => {
    const geometry = circularArcThroughPoints(
      {x: 10, y: 10},
      {x: 50, y: 10},
      {x: 30, y: 30}
    );
    const arc = annotation(geometry?.points ?? []);
    arc.custom = {
      measurementKind: 'arc',
      arcGenerated: true,
      arcControlPoints: geometry && {
        start: geometry.start,
        end: geometry.end,
        through: geometry.through
      },
      arcThroughVertexIndex: geometry?.throughVertexIndex
    };
    const changed = [...arc.vertices];
    changed[geometry?.throughVertexIndex ?? 0] = {x: 30, y: -20};
    const transform = createArcTransform((_, context) => context.changes);
    const patch = transform(arc, {type: 'vertex-edit', changes: {vertices: changed}});
    const updated = {...arc, ...patch} as PdfPolylineAnnoObject;
    const controls = arcControlPoints(updated);

    expect(controls?.through).toEqual({x: 30, y: -20});
    expect(arcDetails(updated, 1, 'm', 2)?.lengthValue).toBeGreaterThan(0);
  });
});
