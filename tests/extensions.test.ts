import {describe, expect, it} from 'vitest';
import {GuidesState} from '@elvisreis/markflow-core';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {createSSRApp, h} from 'vue';
import {renderToString as renderVue} from '@vue/server-renderer';
const components = ['Crosshair', 'Rulers', 'Guides'];
for (const title of components) {
  const kind = title.toLowerCase();
  describe('independent ' + kind + ' package', () => {
    it('exposes only its component and shares the same state across packages', async () => {
      const native = await import('@elvisreis/markflow-' + kind);
      expect(native.GuidesState).toBe(GuidesState);
      const options = native.createOverlayOptions();
      const host = document.createElement('div');
      const mounted = native['mount' + title](host, options);
      mounted.update(); mounted.destroy(); mounted.destroy();
      expect(host.shadowRoot?.childElementCount).toBe(0);
      const react = await import('@elvisreis/markflow-' + kind + '/react');
      expect(Object.keys(react)).toEqual(['MarkFlow' + title]);
      expect(renderToString(createElement(react['MarkFlow' + title], {options}))).toContain('data-markflow-overlay="' + kind + '"');
      const vue = await import('@elvisreis/markflow-' + kind + '/vue');
      expect(Object.keys(vue)).toEqual(['MarkFlow' + title]);
      expect(await renderVue(createSSRApp({render: () => h(vue['MarkFlow' + title], {options})}))).toContain('data-markflow-overlay="' + kind + '"');
      options.state.destroy();
    });
  });
}
