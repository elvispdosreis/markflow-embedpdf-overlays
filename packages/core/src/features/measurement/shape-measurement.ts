import type {AnnotationTool, Position, Size} from '@embedpdf/snippet';

type PointerHandler = NonNullable<AnnotationTool['pointerHandler']>;

export function constrainPointToSquare(start: Position, current: Position, pageSize: Size): Position {
  const horizontalDirection = directionForAxis(current.x - start.x, start.x, pageSize.width - start.x);
  const verticalDirection = directionForAxis(current.y - start.y, start.y, pageSize.height - start.y);
  const requestedSide = Math.max(Math.abs(current.x - start.x), Math.abs(current.y - start.y));
  const horizontalRoom = horizontalDirection > 0 ? pageSize.width - start.x : start.x;
  const verticalRoom = verticalDirection > 0 ? pageSize.height - start.y : start.y;
  const side = Math.min(requestedSide, horizontalRoom, verticalRoom);

  return {
    x: start.x + horizontalDirection * side,
    y: start.y + verticalDirection * side
  };
}

export function createAspectRatioPointerHandler(baseHandler: PointerHandler): PointerHandler {
  return {
    annotationType: baseHandler.annotationType,
    create(context) {
      const handlers = baseHandler.create(context);
      let start: Position | null = null;
      const pointForEvent = (point: Position, shiftKey: boolean): Position => (
        start && shiftKey ? constrainPointToSquare(start, point, context.pageSize) : point
      );

      return {
        ...handlers,
        onPointerDown: (point, event, modeId) => {
          start = point;
          handlers.onPointerDown?.(point, event, modeId);
        },
        onPointerMove: (point, event, modeId) => {
          handlers.onPointerMove?.(pointForEvent(point, event.shiftKey), event, modeId);
        },
        onPointerUp: (point, event, modeId) => {
          handlers.onPointerUp?.(pointForEvent(point, event.shiftKey), event, modeId);
          start = null;
        },
        onPointerLeave: (point, event, modeId) => {
          handlers.onPointerLeave?.(point, event, modeId);
          start = null;
        },
        onPointerCancel: (point, event, modeId) => {
          handlers.onPointerCancel?.(point, event, modeId);
          start = null;
        }
      };
    }
  };
}

function directionForAxis(delta: number, negativeRoom: number, positiveRoom: number): -1 | 1 {
  if (delta > 0) return 1;
  if (delta < 0) return -1;
  return positiveRoom >= negativeRoom ? 1 : -1;
}
