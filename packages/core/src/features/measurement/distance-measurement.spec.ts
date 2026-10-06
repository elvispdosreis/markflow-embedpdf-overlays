import {
  PdfAnnotationBorderStyle,
  PdfAnnotationLineEnding,
  PdfAnnotationSubtype,
  type PdfLineAnnoObject
} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {
  buildDistanceDecorations,
  createDistancePointerHandler,
  createDistanceTransform,
  distanceDetails,
  distanceLinePatch,
  isDistanceDecoration,
  linePointsForDistance,
  setDistanceAngleConstraintActive,
  snapDistanceEndpoint
} from './distance-measurement';

const line: PdfLineAnnoObject = {
  id: 'distance-1',
  pageIndex: 0,
  type: PdfAnnotationSubtype.LINE,
  rect: {origin: {x: 10, y: 20}, size: {width: 40, height: 30}},
  linePoints: {start: {x: 10, y: 20}, end: {x: 50, y: 50}},
  color: 'transparent',
  opacity: 1,
  strokeWidth: 1,
  strokeColor: '#ef4444',
  strokeStyle: PdfAnnotationBorderStyle.SOLID
};

describe('distance measurement annotation', () => {
  it('configures closed arrows and dimension metadata', () => {
    const patch = distanceLinePatch(line, '25,00 m');

    expect(patch.lineEndings).toEqual({
      start: PdfAnnotationLineEnding.ClosedArrow,
      end: PdfAnnotationLineEnding.ClosedArrow
    });
    expect(patch.contents).toBe('25,00 m');
    expect(patch.intent).toBe('LineDimension');
  });

  it('creates two witness lines and one centered text label', () => {
    const [startWitness, endWitness, label] = buildDistanceDecorations(line, '25,00 m');

    expect(startWitness.type).toBe(PdfAnnotationSubtype.LINE);
    expect(endWitness.type).toBe(PdfAnnotationSubtype.LINE);
    expect(label.type).toBe(PdfAnnotationSubtype.FREETEXT);
    expect(label.contents).toBe('25,00 m');
    expect(label.fontSize).toBe(10);
    expect(label.fontColor).toBe('#ef4444');
    expect(label.strokeColor).toBe(label.fontColor);
    expect(label.strokeWidth).toBe(0);
    expect(label.color).toBe('transparent');
    expect(label.flags).toEqual(['print', 'readOnly', 'locked']);
    expect(label.inReplyToId).toBeUndefined();
    expect(label.rect.origin.x + label.rect.size.width / 2).toBe(30);
    expect(label.rect.origin.y + label.rect.size.height / 2).toBe(35);
    expect(isDistanceDecoration(startWitness)).toBe(true);
    expect(isDistanceDecoration(label)).toBe(true);
  });

  it('calculates distance, angle and axis projections for the popup', () => {
    const details = distanceDetails(line, 0.5, 'm', 2);

    expect(details.formattedDistance).toBe('25,00 m');
    expect(details.formattedAngle).toBe('36,87°');
    expect(details.formattedXAxis).toBe('20,00 m');
    expect(details.formattedYAxis).toBe('15,00 m');
  });

  it('repositions the endpoint from manual distance and angle values', () => {
    const points = linePointsForDistance({x: 10, y: 20}, 20, 45, 0.5);

    expect(points.start).toEqual({x: 10, y: 20});
    expect(points.end.x).toBeCloseTo(38.2843, 4);
    expect(points.end.y).toBeCloseTo(48.2843, 4);
  });

  it('restringe o ponto final ao ângulo de 22,5 graus mais próximo', () => {
    const start = {x: 100, y: 100};
    const directions = [
      0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180,
      202.5, 225, 247.5, 270, 292.5, 315, 337.5, 360
    ];

    for (const expected of directions) {
      const normalized = expected === 360 ? 0 : expected;
      const inputAngle = (normalized + (expected === 360 ? -5 : 5)) * Math.PI / 180;
      const snapped = snapDistanceEndpoint(start, {
        x: start.x + Math.cos(inputAngle) * 50,
        y: start.y + Math.sin(inputAngle) * 50
      });
      const result = (Math.atan2(snapped.y - start.y, snapped.x - start.x) * 180 / Math.PI + 360) % 360;
      expect(result).toBeCloseTo(normalized, 6);
    }
  });

  it('aplica a restrição angular com Shift durante a criação da distância', () => {
    const committed: PdfLineAnnoObject[] = [];
    const handler = createDistancePointerHandler().create({
      pageIndex: 0,
      pageSize: {width: 500, height: 500},
      pageRotation: 0,
      scale: 1,
      services: {},
      getTool: () => ({
        defaults: line,
        clickBehavior: {enabled: true, defaultLength: 100, defaultAngle: 0}
      }),
      getToolContext: () => undefined,
      onPreview: () => undefined,
      onCommit: (annotation: PdfLineAnnoObject) => committed.push(annotation)
    } as never);
    const event = {shiftKey: true, setPointerCapture: () => undefined, releasePointerCapture: () => undefined} as never;

    handler.onPointerDown?.({x: 100, y: 100}, event, 'measure-distance');
    handler.onPointerMove?.({x: 150, y: 108}, event, 'measure-distance');
    handler.onPointerUp?.({x: 150, y: 108}, event, 'measure-distance');

    expect(committed).toHaveLength(1);
    expect(committed[0].linePoints.end.y).toBeCloseTo(100, 6);
    expect(committed[0].linePoints.end.x).toBeGreaterThan(150);
  });

  it('aplica a restrição angular com Shift ao mover um vértice existente', () => {
    const transform = createDistanceTransform(undefined);
    setDistanceAngleConstraintActive(true);

    try {
      const patch = transform(line, {
        type: 'vertex-edit',
        changes: {
          linePoints: {start: line.linePoints.start, end: {x: 40, y: 45}}
        }
      });
      const points = patch.linePoints!;
      const angle = (Math.atan2(
        points.end.y - points.start.y,
        points.end.x - points.start.x
      ) * 180 / Math.PI + 360) % 360;
      expect(angle).toBeCloseTo(45, 6);
    } finally {
      setDistanceAngleConstraintActive(false);
    }
  });
});
