import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {measurementSidebarItems} from './measurement-sidebar.models';

const calibration = {linearFactor: 2, unit: 'm' as const, precision: 1};
const base = {
  pageIndex: 0,
  color: 'transparent',
  opacity: 1,
  strokeColor: '#ef4444',
  strokeWidth: 1,
  custom: {measurementCalibration: calibration}
};

const annotations = [
  {
    ...base,
    id: 'distance',
    type: PdfAnnotationSubtype.LINE,
    rect: {origin: {x: 1, y: 1}, size: {width: 3, height: 4}},
    linePoints: {start: {x: 1, y: 1}, end: {x: 4, y: 5}},
    custom: {...base.custom, measurementKind: 'distance'}
  },
  {
    ...base,
    id: 'perimeter',
    type: PdfAnnotationSubtype.POLYLINE,
    rect: {origin: {x: 10, y: 10}, size: {width: 7, height: 4}},
    vertices: [{x: 10, y: 10}, {x: 13, y: 10}, {x: 13, y: 14}],
    custom: {...base.custom, measurementKind: 'perimeter'}
  },
  {
    ...base,
    id: 'area',
    type: PdfAnnotationSubtype.POLYGON,
    rect: {origin: {x: 20, y: 20}, size: {width: 4, height: 3}},
    vertices: [{x: 20, y: 20}, {x: 24, y: 20}, {x: 24, y: 23}],
    custom: {...base.custom, measurementKind: 'area'}
  },
  {
    ...base,
    id: 'rectangle',
    type: PdfAnnotationSubtype.SQUARE,
    rect: {origin: {x: 30, y: 30}, size: {width: 4, height: 3}},
    custom: {...base.custom, measurementKind: 'rectangle-area'}
  },
  {
    ...base,
    id: 'ellipse',
    type: PdfAnnotationSubtype.CIRCLE,
    rect: {origin: {x: 40, y: 40}, size: {width: 4, height: 2}},
    custom: {...base.custom, measurementKind: 'ellipse', measurementQuantity: 'area'}
  },
  {
    ...base,
    id: 'arc',
    type: PdfAnnotationSubtype.POLYLINE,
    rect: {origin: {x: 50, y: 45}, size: {width: 10, height: 5}},
    vertices: [{x: 50, y: 50}, {x: 55, y: 45}, {x: 60, y: 50}],
    intent: 'MarkFlowArcMeasurement',
    custom: {
      ...base.custom,
      measurementKind: 'arc',
      arcControlPoints: {start: {x: 50, y: 50}, through: {x: 55, y: 45}, end: {x: 60, y: 50}}
    }
  }
] as PdfAnnotationObject[];

describe('measurement sidebar item projection', () => {
  it('derives rich details for every measurement kind', () => {
    const items = measurementSidebarItems(annotations, calibration);

    expect(items.map(item => item.kind)).toEqual([
      'distance', 'perimeter', 'area', 'rectangle-area', 'ellipse', 'arc'
    ]);
    expect(items.find(item => item.kind === 'distance')).toMatchObject({
      formattedValue: '10,0 m',
      detailRows: expect.arrayContaining([
        {labelKey: 'markflow.measurements.sidebar.angle', value: '53,1°'},
        {labelKey: 'markflow.measurements.sidebar.axisX', value: '6,0 m'},
        {labelKey: 'markflow.measurements.sidebar.axisY', value: '8,0 m'}
      ])
    });
    expect(items.find(item => item.kind === 'perimeter')?.detailRows).toEqual(expect.arrayContaining([
      {labelKey: 'markflow.measurements.sidebar.segments', value: '2'},
      {labelKey: 'markflow.measurements.sidebar.segment', value: '1: 6,0 m', highlight: {kind: 'segment', index: 0}},
      {labelKey: 'markflow.measurements.sidebar.segment', value: '2: 8,0 m', highlight: {kind: 'segment', index: 1}}
    ]));
    expect(items.find(item => item.kind === 'area')?.detailRows).toEqual(expect.arrayContaining([
      {labelKey: 'markflow.measurements.sidebar.vertices', value: '3'},
      {labelKey: 'markflow.measurements.sidebar.perimeterValue', value: '24,0 m'},
      {labelKey: 'markflow.measurements.sidebar.vertex', value: '1: 8,0 m', highlight: {kind: 'vertex', index: 0}},
      {labelKey: 'markflow.measurements.sidebar.vertex', value: '2: 6,0 m', highlight: {kind: 'vertex', index: 1}},
      {labelKey: 'markflow.measurements.sidebar.vertex', value: '3: 10,0 m', highlight: {kind: 'vertex', index: 2}}
    ]));
    expect(items.find(item => item.kind === 'rectangle-area')?.detailRows).toEqual(expect.arrayContaining([
      {labelKey: 'markflow.measurements.sidebar.width', value: '8,0 m'},
      {labelKey: 'markflow.measurements.sidebar.height', value: '6,0 m'}
    ]));
    expect(items.find(item => item.kind === 'ellipse')?.detailRows).toEqual(expect.arrayContaining([
      {labelKey: 'markflow.measurements.sidebar.horizontalAxis', value: '8,0 m'},
      {labelKey: 'markflow.measurements.sidebar.verticalAxis', value: '4,0 m'},
      {labelKey: 'markflow.measurements.sidebar.areaValue', value: expect.stringContaining('m²')},
      {labelKey: 'markflow.measurements.sidebar.perimeterValue', value: expect.stringContaining('m')}
    ]));
    expect(items.find(item => item.kind === 'arc')?.detailRows.map(row => row.labelKey)).toEqual(expect.arrayContaining([
      'markflow.measurements.sidebar.radius',
      'markflow.measurements.sidebar.centralAngle',
      'markflow.measurements.sidebar.chord'
    ]));
  });

  it('sorts by page and position and skips generated decorations', () => {
    const decoration = {
      ...annotations[0],
      id: 'decoration',
      pageIndex: 0,
      custom: {measurementDecorationFor: 'distance'}
    } as PdfAnnotationObject;
    const laterPage = {...annotations[0], id: 'later', pageIndex: 2} as PdfAnnotationObject;

    const items = measurementSidebarItems([laterPage, decoration, ...annotations], calibration);

    expect(items.at(-1)?.id).toBe('later');
    expect(items.some(item => item.id === 'decoration')).toBe(false);
  });

  it('keeps valid measurements when an imported annotation has malformed geometry', () => {
    const malformed = {
      ...annotations[0], id: 'malformed',
      linePoints: undefined
    } as unknown as PdfAnnotationObject;

    const items = measurementSidebarItems([malformed, annotations[0]], calibration);

    expect(items.map(item => item.id)).toEqual(['distance']);
  });
});
