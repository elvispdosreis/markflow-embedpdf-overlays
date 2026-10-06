import {describe, expect, it, vi} from 'vitest';
import {
  registerMeasurementStyleBridge,
  type MeasurementStyleBridge
} from './measurement-style-bridge';
import {MeasurementStyleSidebar} from './measurement-style-sidebar';

describe('MeasurementStyleSidebar', () => {
  it('renders the native style controls for the selected measurement and applies changes', () => {
    const update = vi.fn();
    const bridge: MeasurementStyleBridge = {
      snapshot: () => ({
        kind: 'rectangle-area',
        label: 'Área retangular',
        mode: 'selection',
        values: {
          color: 'transparent', opacity: 1, strokeColor: '#ef4444',
          strokeStyle: 1, strokeWidth: 2, rotation: 0
        }
      }),
      update,
      colorPresets: () => ['#ef4444', '#0ea5e9'],
      translate: (_documentId, _key, fallback) => fallback
    };
    const dispose = registerMeasurementStyleBridge(bridge);
    const vnode = MeasurementStyleSidebar({documentId: 'doc'} as never);
    expect(vnode.type).toBe('markflow-measurement-style-view');
    expect(vnode.props).toMatchObject({documentId: 'doc'});

    const view = Object.assign(document.createElement('markflow-measurement-style-view'), {documentId: 'doc'});
    document.body.append(view);
    expect(view.querySelector('h2')?.textContent).toBe('Estilos de Área retangular');
    expect(view.querySelectorAll('[data-style-property]')).toHaveLength(6);
    const strokeColor = view.querySelector<HTMLButtonElement>('[data-style-property="strokeColor"] button[data-color="#0ea5e9"]');
    strokeColor?.click();
    expect(update).toHaveBeenCalledWith('doc', 'strokeColor', '#0ea5e9');

    view.remove();
    dispose();
  });

  it.each(['area', 'rectangle-area', 'ellipse'] as const)('offers fill pattern previews for %s', kind => {
    let pattern = 'solid';
    const dispose = registerMeasurementStyleBridge({
      snapshot: () => ({kind, label: 'Área', mode: 'selection', values: {fillPattern: pattern} as never}),
      update: (_id, _property, value) => {pattern = String(value);},
      colorPresets: () => [], translate: (_id, _key, fallback) => fallback
    });
    MeasurementStyleSidebar({documentId: 'doc'} as never);
    const view = Object.assign(document.createElement('markflow-measurement-style-view'), {documentId: 'doc'});
    document.body.append(view);
    const cross = view.querySelector<HTMLButtonElement>('button[aria-label="Cruzado"]');
    expect(cross).not.toBeNull();
    cross!.click();
    expect(pattern).toBe('crosshatch');
    expect(view.querySelector('button[aria-label="Cruzado"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(view.querySelectorAll('[data-style-property="fillPattern"] button')).toHaveLength(7);
    expect(view.querySelector('[data-style-property="strokeStyle"]')).toBeNull();
    view.remove(); dispose();
  });
});
