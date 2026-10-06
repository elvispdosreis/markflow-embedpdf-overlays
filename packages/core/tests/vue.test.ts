import {createApp, h, shallowRef, nextTick} from 'vue';
import {renderToString} from '@vue/server-renderer';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ViewerCrosshair, ViewerGuides} from '../src/vue';
import {options, crosshairContext} from './fixtures';

describe('Vue adapters', () => {
  afterEach(() => {vi.unstubAllGlobals(); document.body.replaceChildren();});
  it('tracks reactive getters and removes native page handlers when disabled/unmounted', async () => {
    const fixture = crosshairContext(), enabled = shallowRef(true);
    const dependencies = options();
    dependencies.crosshairContext = () => fixture.context;
    dependencies.crosshairEnabled = () => enabled.value;
    const container = document.createElement('div'); document.body.append(container);
    const app = createApp({render: () => h(ViewerCrosshair, {options: dependencies})});
    app.mount(container); await nextTick();
    expect(fixture.registerAlways).toHaveBeenCalledTimes(1);
    enabled.value = false; await nextTick();
    expect(fixture.disposed).toHaveBeenCalledTimes(1);
    enabled.value = true; await nextTick();
    expect(fixture.registerAlways).toHaveBeenCalledTimes(2);
    app.unmount();
    expect(fixture.disposed).toHaveBeenCalledTimes(2);
    expect(fixture.unsubscribe).toHaveBeenCalledTimes(2);
  });
  it('renders the host during SSR and defers browser mounting until onMounted', async () => {
    const html = await renderToString(createApp({render: () => h(ViewerGuides, {options: options()})}));
    expect(html).toContain('data-markflow-overlay="guides"');
    expect(html).not.toContain('<svg');
  });
});
