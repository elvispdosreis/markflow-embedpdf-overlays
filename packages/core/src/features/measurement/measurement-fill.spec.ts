import {PdfAnnotationSubtype, type PdfPolygonAnnoObject, type PdfSquareAnnoObject} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {buildMeasurementFill, measurementFillColor, measurementFillPattern, measurementFillStylePatch} from './measurement-fill';
import {createXfdf, parseXfdf} from '../export/xfdf-export';

const rectangle: PdfSquareAnnoObject = {
  id: 'area', pageIndex: 0, type: PdfAnnotationSubtype.SQUARE,
  rect: {origin: {x: 0, y: 0}, size: {width: 100, height: 60}}, color: '#5578D7',
  strokeColor: '#E44234', strokeWidth: 1, opacity: 0.5, flags: ['print'], strokeStyle: 1,
  custom: {measurementKind: 'rectangle-area', measurementCalibration: {linearFactor: 2, unit: 'm', precision: 2}}
};

describe('measurement fill patterns', () => {
  it('keeps the chosen fill color and calibration when changing pattern, then restores solid fill', () => {
    const hatched = {...rectangle, ...measurementFillStylePatch(rectangle, 'fillPattern', 'diagonal')} as PdfSquareAnnoObject;
    expect(hatched.color).toBe('transparent');
    expect(hatched.custom.measurementCalibration).toEqual({linearFactor: 2, unit: 'm', precision: 2});
    expect(measurementFillColor(hatched)).toBe('#5578D7');
    expect(measurementFillPattern(hatched)).toBe('diagonal');
    const recolored = {...hatched, ...measurementFillStylePatch(hatched, 'color', '#36C2C9')};
    expect(recolored.color).toBe('transparent');
    expect(measurementFillStylePatch(recolored, 'fillPattern', 'solid')).toMatchObject({color: '#36C2C9'});
  });

  it('produces horizontal strokes only inside the rectangle with the selected color and opacity', () => {
    const fill = buildMeasurementFill({...rectangle, ...measurementFillStylePatch(rectangle, 'fillPattern', 'horizontal')} as PdfSquareAnnoObject)!;
    expect(fill.type).toBe(PdfAnnotationSubtype.INK);
    expect(fill.strokeColor).toBe('#5578D7');
    expect(fill.opacity).toBe(0.5);
    expect(fill.custom.measurementDecorationFor).toBe('area');
    expect(fill.inkList[0].points).toEqual([{x: 1.5, y: 10}, {x: 98.5, y: 10}]);
    expect(fill.inkList).toHaveLength(5);
  });

  it('leaves the empty center of a concave area unhatched', () => {
    const polygon = {...rectangle, type: PdfAnnotationSubtype.POLYGON,
      rect: {origin: {x: 0, y: 0}, size: {width: 100, height: 100}},
      vertices: [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 100}, {x: 70, y: 100},
        {x: 70, y: 30}, {x: 30, y: 30}, {x: 30, y: 100}, {x: 0, y: 100}],
      custom: {measurementKind: 'area', measurementFillPattern: 'horizontal'}} as PdfPolygonAnnoObject;
    const strokes = buildMeasurementFill(polygon)!.inkList.filter(stroke => stroke.points[0].y === 40);
    expect(strokes.map(stroke => stroke.points)).toEqual([
      [{x: 0.5, y: 40}, {x: 29.5, y: 40}], [{x: 70.5, y: 40}, {x: 99.5, y: 40}]
    ]);
  });

  it.each(['diagonal', 'horizontal', 'vertical', 'crosshatch', 'dots', 'crosses'] as const)('clips %s to the ellipse', pattern => {
    const ellipse = {...rectangle, type: PdfAnnotationSubtype.CIRCLE,
      custom: {measurementKind: 'ellipse', measurementFillPattern: pattern}} as never;
    const fill = buildMeasurementFill(ellipse)!;
    expect(fill.inkList.length).toBeGreaterThan(0);
    for (const stroke of fill.inkList) for (const point of stroke.points) {
      expect(((point.x - 50) / 50) ** 2 + ((point.y - 30) / 30) ** 2).toBeLessThanOrEqual(1);
    }
  });

  it('draws separate rotated crosses on the same grid as dots and preserves them in XFDF', () => {
    const source = {...rectangle, ...measurementFillStylePatch(rectangle, 'fillPattern', 'crosses')} as PdfSquareAnnoObject;
    const restored = parseXfdf(createXfdf([source])).annotations[0] as PdfSquareAnnoObject;
    expect(measurementFillPattern(restored)).toBe('crosses');
    const strokes = buildMeasurementFill(restored)!.inkList;
    expect(strokes).toHaveLength(120);
    expect(strokes[0].points[0].x).toBeCloseTo(3);
    expect(strokes[0].points[0].y).toBeCloseTo(7);
    expect(strokes[0].points[1].x).toBeCloseTo(7);
    expect(strokes[0].points[1].y).toBeCloseTo(3);
    expect(strokes[1].points[0].x).toBeCloseTo(3);
    expect(strokes[1].points[0].y).toBeCloseTo(3);
    expect(strokes[1].points[1].x).toBeCloseTo(7);
    expect(strokes[1].points[1].y).toBeCloseTo(7);
  });

  it('rotates the hatch together with its rectangular area', () => {
    const rotated = {...rectangle, rotation: 90, unrotatedRect: rectangle.rect,
      rect: {origin: {x: 20, y: -20}, size: {width: 60, height: 100}},
      custom: {measurementKind: 'rectangle-area', measurementFillPattern: 'horizontal'}};
    const points = buildMeasurementFill(rotated)!.inkList[0].points;
    expect(points[0].x).toBeCloseTo(70); expect(points[0].y).toBeCloseTo(-18.5);
    expect(points[1].x).toBeCloseTo(70); expect(points[1].y).toBeCloseTo(78.5);
  });

  it('keeps solid and old measurements free of generated strokes', () => {
    expect(buildMeasurementFill(rectangle)).toBeNull();
    expect(buildMeasurementFill({...rectangle, custom: {measurementKind: 'rectangle-area', measurementFillPattern: 'unknown'}})).toBeNull();
  });

  it('makes a hatch visible from the default hollow style, but respects an explicit transparent color', () => {
    const hollow = {...rectangle, color: 'transparent'};
    const hatched = {...hollow, ...measurementFillStylePatch(hollow, 'fillPattern', 'diagonal')} as PdfSquareAnnoObject;
    expect(measurementFillColor(hatched)).toBe('#E44234');
    expect(buildMeasurementFill(hatched)).not.toBeNull();
    const cleared = {...hatched, ...measurementFillStylePatch(hatched, 'color', 'transparent')} as PdfSquareAnnoObject;
    expect(buildMeasurementFill(cleared)).toBeNull();
  });

  it('preserves the unrotated geometry when a rotated patterned shape is saved and loaded as XFDF', () => {
    const rotated = {...rectangle, rotation: 90, unrotatedRect: rectangle.rect,
      rect: {origin: {x: 20, y: -20}, size: {width: 60, height: 100}},
      custom: {measurementKind: 'rectangle-area', measurementFillPattern: 'horizontal'}};
    const restored = parseXfdf(createXfdf([rotated])).annotations[0] as PdfSquareAnnoObject;
    expect(restored.unrotatedRect).toEqual(rectangle.rect);
    const points = buildMeasurementFill(restored)!.inkList[0].points;
    expect(points[0].x).toBeCloseTo(70); expect(points[0].y).toBeCloseTo(-18.5);
  });

  it('rotates a polygon hatch with the unrotated vertices used by the PDF engine', () => {
    const rotated = {...rectangle, type: PdfAnnotationSubtype.POLYGON, rotation: 90,
      unrotatedRect: rectangle.rect, rect: {origin: {x: 20, y: -20}, size: {width: 60, height: 100}},
      vertices: [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 60}, {x: 0, y: 60}],
      custom: {measurementKind: 'area', measurementFillPattern: 'horizontal'}} as PdfPolygonAnnoObject;
    const points = buildMeasurementFill(rotated)!.inkList[0].points;
    expect(points[0].x).toBeCloseTo(70); expect(points[0].y).toBeCloseTo(-19.5);
    expect(points[1].x).toBeCloseTo(70); expect(points[1].y).toBeCloseTo(79.5);
  });
});
