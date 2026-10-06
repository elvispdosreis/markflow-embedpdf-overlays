import {describe, expect, it, vi} from 'vitest';
import {MeasurementHighlightController} from './measurement-highlight-controller';
describe('MeasurementHighlightController', () => {
  it('coalesces drawing requests, clears stale selection and cancels its pending frame on destruction', () => {
    const drawing = vi.fn(), cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const request = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    try {
      const controller = new MeasurementHighlightController({
        getContext: () => null, getAnnotation: () => undefined,
        getHostBounds: () => new DOMRect(), onDrawing: drawing
      });
      controller.selection = {documentId: 'a', annotationId: 'x', pageIndex: 0, kind: 'vertex', index: 0};
      controller.renderMeasurementDetailHighlight();
      expect(drawing).toHaveBeenLastCalledWith(null);
      controller.scheduleMeasurementDetailHighlight(); controller.scheduleMeasurementDetailHighlight();
      expect(request).toHaveBeenCalledTimes(1);
      controller.destroy(); controller.destroy(); controller.scheduleMeasurementDetailHighlight();
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(controller.selection).toBeNull();
    } finally {vi.restoreAllMocks();}
  });
});
