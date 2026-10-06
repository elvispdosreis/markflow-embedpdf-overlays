import type {AnnotationTool, Position, Size} from '@embedpdf/snippet';
import {PdfAnnotationSubtype} from '@embedpdf/snippet';
import {snapDistanceEndpointWithinPage} from './distance-measurement';

type PointerHandler = NonNullable<AnnotationTool['pointerHandler']>;

/** Adds CAD-style angular snapping while leaving the native vertex workflow intact. */
export function createSegmentAnglePointerHandler(baseHandler: PointerHandler): PointerHandler {
  return {
    annotationType: baseHandler.annotationType,
    create(context) {
      let vertices: Position[] = [];
      const reset = () => { vertices = []; };
      const handlers = baseHandler.create({
        ...context,
        onCommit: (annotation, createContext) => {
          reset();
          context.onCommit(annotation, createContext);
        }
      });
      const clamp = (point: Position): Position => ({
        x: Math.max(0, Math.min(context.pageSize.width, point.x)),
        y: Math.max(0, Math.min(context.pageSize.height, point.y))
      });
      const isClosingPolygon = (point: Position) => (
        baseHandler.annotationType === PdfAnnotationSubtype.POLYGON
        && vertices.length >= 3
        && isNear(point, vertices[0], 7 / context.scale)
      );
      const constrained = (point: Position, shiftKey: boolean): Position => {
        const current = clamp(point);
        const last = vertices.at(-1);
        return last && shiftKey
          ? snapDistanceEndpointWithinPage(last, current, context.pageSize as Size)
          : current;
      };

      return {
        ...handlers,
        onClick: (point, event, modeId) => {
          if (event.metaKey || event.ctrlKey) {
            handlers.onClick?.(point, event, modeId);
            return;
          }
          const raw = clamp(point);
          const closingPolygon = isClosingPolygon(raw);
          const forwarded = closingPolygon ? raw : constrained(raw, event.shiftKey);
          handlers.onClick?.(forwarded, event, modeId);
          const last = vertices.at(-1);
          if (!closingPolygon && (!last || !isNear(forwarded, last, 1))) {
            vertices = [...vertices, forwarded];
          }
        },
        onPointerMove: (point, event, modeId) => {
          handlers.onPointerMove?.(constrained(point, event.shiftKey), event, modeId);
        },
        onPointerCancel: (point, event, modeId) => {
          handlers.onPointerCancel?.(point, event, modeId);
          reset();
        },
        onHandlerActiveEnd: modeId => {
          handlers.onHandlerActiveEnd?.(modeId);
          reset();
        }
      };
    }
  };
}

function isNear(a: Position, b: Position, tolerance: number): boolean {
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}
