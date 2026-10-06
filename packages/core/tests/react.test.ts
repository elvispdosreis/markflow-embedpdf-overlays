import {createElement, StrictMode, act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ViewerCrosshair, ViewerGuides} from '../src/react';
import {options, crosshairContext} from './fixtures';
import {GuidesState} from '../src';

describe('React adapters', () => {
  afterEach(() => {vi.unstubAllGlobals(); document.body.replaceChildren();});
  it('survives StrictMode, updates options/state and cleans native page handlers on unmount', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const fixture = crosshairContext();
    const initial = options(); initial.crosshairContext = () => fixture.context;
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    const view = (value: typeof initial) => createElement(StrictMode, null, createElement(ViewerCrosshair, {options: value}));
    await act(async () => root.render(view(initial)));
    expect(fixture.registerAlways).toHaveBeenCalledTimes(2);
    expect(fixture.disposed).toHaveBeenCalledTimes(1);
    await act(async () => root.render(view({...initial, state: new GuidesState()})));
    expect(fixture.registerAlways).toHaveBeenCalledTimes(3);
    await act(async () => root.render(view({...initial, crosshairEnabled: () => false})));
    expect(fixture.disposed).toHaveBeenCalledTimes(3);
    await act(async () => root.unmount());
    expect(fixture.unsubscribe).toHaveBeenCalledTimes(3);
    fixture.viewer.remove();
  });
  it('can render its host on the server without accessing browser APIs', () => {
    const html = renderToString(createElement(ViewerGuides, {options: options()}));
    expect(html).toContain('data-markflow-overlay="guides"');
    expect(html).not.toContain('<svg');
  });
});
