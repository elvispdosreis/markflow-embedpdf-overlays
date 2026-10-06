import {PdfAnnotationSubtype} from '@embedpdf/snippet';
import {describe, expect, it, vi} from 'vitest';
import {constrainPointToSquare, createAspectRatioPointerHandler} from './shape-measurement';

describe('measurement shape aspect-ratio constraint', () => {
  it('cria lados iguais em todas as direções e respeita os limites da página', () => {
    const pageSize = {width: 100, height: 80};

    expect(constrainPointToSquare({x: 50, y: 40}, {x: 80, y: 50}, pageSize)).toEqual({x: 80, y: 70});
    expect(constrainPointToSquare({x: 50, y: 40}, {x: 20, y: 55}, pageSize)).toEqual({x: 20, y: 70});
    expect(constrainPointToSquare({x: 50, y: 40}, {x: 90, y: 0}, pageSize)).toEqual({x: 90, y: 0});
    expect(constrainPointToSquare({x: 90, y: 70}, {x: 120, y: 100}, pageSize)).toEqual({x: 100, y: 80});
  });

  it('entrega ao handler nativo um ponto quadrado somente com Shift pressionado', () => {
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    const baseHandler = {
      annotationType: PdfAnnotationSubtype.SQUARE,
      create: () => ({onPointerDown: vi.fn(), onPointerMove, onPointerUp})
    } as NonNullable<import('@embedpdf/snippet').AnnotationTool['pointerHandler']>;
    const handler = createAspectRatioPointerHandler(baseHandler).create({
      pageSize: {width: 500, height: 500}
    } as never);
    const plainEvent = {shiftKey: false} as never;
    const shiftEvent = {shiftKey: true} as never;

    handler.onPointerDown?.({x: 100, y: 100}, plainEvent, 'measure-rectangle-area');
    handler.onPointerMove?.({x: 160, y: 125}, shiftEvent, 'measure-rectangle-area');
    handler.onPointerUp?.({x: 160, y: 125}, shiftEvent, 'measure-rectangle-area');

    expect(onPointerMove).toHaveBeenCalledWith({x: 160, y: 160}, shiftEvent, 'measure-rectangle-area');
    expect(onPointerUp).toHaveBeenCalledWith({x: 160, y: 160}, shiftEvent, 'measure-rectangle-area');
  });
});
