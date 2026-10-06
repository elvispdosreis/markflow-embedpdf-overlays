import {
  PdfAnnotationBorderStyle,
  PdfAnnotationLineEnding,
  PdfAnnotationName,
  PdfAnnotationSubtype,
  type PdfLineAnnoObject,
  type PdfPolylineAnnoObject,
  type PdfSquareAnnoObject
} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {decorateTechnicalComment, technicalCommentFromAnnotation} from '../technical-comments/technical-comment.models';
import {createXfdf, parseXfdf} from './xfdf-export';

const distance: PdfLineAnnoObject = {
  id: 'distance-1',
  pageIndex: 0,
  type: PdfAnnotationSubtype.LINE,
  rect: {origin: {x: 10, y: 20}, size: {width: 40, height: 30}},
  linePoints: {start: {x: 10, y: 20}, end: {x: 50, y: 50}},
  color: 'transparent',
  opacity: 1,
  strokeWidth: 1,
  strokeColor: '#ef4444',
  strokeStyle: PdfAnnotationBorderStyle.SOLID,
  lineEndings: {
    start: PdfAnnotationLineEnding.ClosedArrow,
    end: PdfAnnotationLineEnding.ClosedArrow
  },
  contents: '25,00 m & conferido',
  custom: {measurementKind: 'distance'}
};

describe('XFDF export', () => {
  it('preserves a measurement fill pattern and its chosen color without exporting generated strokes', () => {
    const shape = {...distance, id: 'shape', type: PdfAnnotationSubtype.SQUARE, color: 'transparent',
      custom: {measurementKind: 'rectangle-area', measurementFillPattern: 'crosshatch', measurementFillColor: '#5578D7'}} as unknown as PdfSquareAnnoObject;
    const generated = {...distance, id: 'shape-fill', custom: {measurementDecorationFor: 'shape'}};
    const restored = parseXfdf(createXfdf([shape, generated])).annotations;
    expect(restored).toHaveLength(1);
    expect(restored[0].custom).toMatchObject({measurementFillPattern: 'crosshatch', measurementFillColor: '#5578D7'});
  });
  it('preserves technical comment type, number and text across XFDF export and import', () => {
    const comment = decorateTechnicalComment({
      id: 'comment-9', pageIndex: 1, type: PdfAnnotationSubtype.TEXT,
      rect: {origin: {x: 17, y: 29}, size: {width: 24, height: 24}},
      contents: '', opacity: 1
    }, 'question', 9, 'Suite 2 está em consonância?');

    const xfdf = createXfdf([comment]);
    const restored = parseXfdf(xfdf).annotations[0];

    expect(xfdf).toContain('markflow:comment-kind="question"');
    expect(xfdf).toContain('markflow:comment-number="9"');
    expect(xfdf).toContain('<text ');
    expect(xfdf).toContain('icon="Comment"');
    expect(restored.type).toBe(PdfAnnotationSubtype.TEXT);
    expect(restored).toMatchObject({name: PdfAnnotationName.Comment});
    expect(restored.custom).toMatchObject({technicalComment: {
      kind: 'question', number: 9, body: 'Suite 2 está em consonância?'
    }});
    expect(technicalCommentFromAnnotation(restored)).toMatchObject({
      number: 9, kind: 'question', body: 'Suite 2 está em consonância?'
    });
  });
  it('exporta geometria, conteúdo e metadados das medições', () => {
    const xfdf = createXfdf([distance], {
      fileName: 'planta & revisão.pdf',
      calibration: {linearFactor: 0.5, unit: 'm', precision: 2}
    });

    expect(xfdf).toContain('<f href="planta &amp; revisão.pdf"/>');
    expect(xfdf).toContain('start="10,20"');
    expect(xfdf).toContain('end="50,50"');
    expect(xfdf).toContain('head="ClosedArrow"');
    expect(xfdf).toContain('markflow:measurement-kind="distance"');
    expect(xfdf).toContain('<contents>25,00 m &amp; conferido</contents>');
    expect(xfdf).toContain('<markflow:calibration linear-factor="0.5" unit="m" precision="2"/>');
  });

  it('exporta Shapes sem transformá-los em medição', () => {
    const square = {
      id: 'shape-1',
      pageIndex: 1,
      type: PdfAnnotationSubtype.SQUARE,
      rect: {origin: {x: 2, y: 3}, size: {width: 8, height: 9}},
      flags: [],
      color: '#ffffff',
      opacity: 0.5,
      strokeWidth: 2,
      strokeColor: '#111827',
      strokeStyle: PdfAnnotationBorderStyle.SOLID
    } as PdfSquareAnnoObject;

    const xfdf = createXfdf([square]);

    expect(xfdf).toContain('<square page="1" rect="2,3,10,12"');
    expect(xfdf).not.toContain('markflow:measurement-kind');
  });

  it('importa novamente as anotações e a calibragem do XFDF', () => {
    const xfdf = createXfdf([distance], {
      calibration: {
        linearFactor: 0.5,
        unit: 'm',
        precision: 2,
        mode: 'preset',
        preset: 50,
        paperValue: 1,
        paperUnit: 'mm',
        realValue: 50,
        realUnit: 'mm'
      }
    });

    const imported = parseXfdf(xfdf);
    const line = imported.annotations[0] as PdfLineAnnoObject;

    expect(line.type).toBe(PdfAnnotationSubtype.LINE);
    expect(line.linePoints).toEqual(distance.linePoints);
    expect(line.custom).toEqual({measurementKind: 'distance'});
    expect(imported.calibration).toMatchObject({
      linearFactor: 0.5,
      unit: 'm',
      precision: 2,
      mode: 'preset',
      preset: 50
    });
  });

  it('mantém o arco como medição independente ao exportar e importar', () => {
    const arc = {
      id: 'arc-1',
      pageIndex: 2,
      type: PdfAnnotationSubtype.POLYLINE,
      rect: {origin: {x: 10, y: 10}, size: {width: 20, height: 10}},
      vertices: [{x: 10, y: 20}, {x: 20, y: 10}, {x: 30, y: 20}],
      color: 'transparent',
      opacity: 1,
      strokeWidth: 1,
      strokeColor: '#8b5cf6',
      strokeStyle: PdfAnnotationBorderStyle.SOLID,
      contents: '7,85 m',
      subject: 'Medição de arco',
      custom: {
        measurementKind: 'arc',
        arcGenerated: true,
        arcControlPoints: {
          start: {x: 10, y: 20},
          end: {x: 30, y: 20},
          through: {x: 20, y: 10}
        },
        arcThroughVertexIndex: 1
      }
    } as PdfPolylineAnnoObject;

    const xfdf = createXfdf([arc]);
    const imported = parseXfdf(xfdf).annotations[0] as PdfPolylineAnnoObject;

    expect(xfdf).toContain('markflow:measurement-kind="arc"');
    expect(xfdf).toContain('markflow:arc-p1="10,20"');
    expect(xfdf).toContain('markflow:arc-p2="30,20"');
    expect(xfdf).toContain('markflow:arc-p3="20,10"');
    expect(imported.type).toBe(PdfAnnotationSubtype.POLYLINE);
    expect(imported.vertices).toEqual(arc.vertices);
    expect(imported.contents).toBe('7,85 m');
    expect(imported.custom).toEqual({
      measurementKind: 'arc',
      arcGenerated: false,
      arcThroughVertexIndex: 1,
      arcControlPoints: {
        start: {x: 10, y: 20},
        end: {x: 30, y: 20},
        through: {x: 20, y: 10}
      }
    });
  });
});
