import {describe, expect, it} from 'vitest';
import {mountOverlayView, GuidesState} from '../src';
import {options} from './fixtures';

describe('package core', () => {
  it('exposes standalone mounting with idempotent disposal and preserves host attributes', () => {
    const host = document.createElement('div'); host.style.color = 'red';
    const previous = host.getAttribute('style');
    const mounted = mountOverlayView('guides', host, options());
    mounted.update();
    expect(host.shadowRoot?.querySelector('svg')).not.toBeNull();
    mounted.destroy(); mounted.destroy(); mounted.update();
    expect(host.getAttribute('style')).toBe(previous);
    expect(host.shadowRoot?.childElementCount).toBe(0);
  });
  it('exposes framework-independent per-document guide state', () => {
    const state = new GuidesState();
    state.add('a', 0, 'horizontal', {x: 0, y: 50}, {width: 100, height: 100});
    expect(state.get('a').guides).toHaveLength(1);
    expect(state.get('b').guides).toHaveLength(0);
  });
});
