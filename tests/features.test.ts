import {afterEach, describe, expect, it, vi} from 'vitest';
import catalog from './feature-catalog.json';
import {act, createElement, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {createApp, createSSRApp, h, nextTick, reactive} from 'vue';
import {renderToString as renderVue} from '@vue/server-renderer';
import {createXfdf, parseXfdf, LEGACY_XFDF_EXPIRES_AT} from '@elvispdosreis/markflow-xfdf';
import {CalibrationController} from '@elvispdosreis/markflow-calibration';
import {MeasurementCalculator} from '@elvispdosreis/markflow-measurements';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
afterEach(() => {vi.restoreAllMocks(); document.body.replaceChildren();});
for (const feature of catalog) {
  describe('published ' + feature.kind + ' package', () => {
    it('resolves its entry from built output with its declared public API', async () => {
      const api = await import('@elvispdosreis/markflow-' + feature.kind);
      expect(api[feature.main]).toBeTypeOf('function');
      if (feature.panel) {
        const host = document.createElement('div'); document.body.append(host);
        const dispose = api['mount' + feature.panel](host, 'first-document');
        expect(host.firstElementChild).not.toBeNull();
        expect((host.firstElementChild as HTMLElement & {documentId: string}).documentId).toBe('first-document');
        dispose(); dispose();
        expect(host.childElementCount).toBe(0);
        const react = await import('@elvispdosreis/markflow-' + feature.kind + '/react');
        const Component = react['MarkFlow' + feature.panel];
        expect(renderToString(createElement(Component, {documentId: 'doc'}))).toContain('data-markflow-panel="' + feature.kind + '"');
        const vue = await import('@elvispdosreis/markflow-' + feature.kind + '/vue');
        expect(await renderVue(createSSRApp({render: () => h(vue['MarkFlow' + feature.panel], {documentId: 'doc'})}))).toContain('data-markflow-panel="' + feature.kind + '"');
      }
    });
    if (feature.panel) it('updates document identity and disposes React StrictMode and Vue panel mounts', async () => {
      const getDocument = (host: HTMLElement) => (host.querySelector('[data-markflow-panel]')?.firstElementChild as HTMLElement & {documentId: string}).documentId;
      const host = document.createElement('div'); document.body.append(host);
      const react = await import('@elvispdosreis/markflow-' + feature.kind + '/react');
      const Component = react['MarkFlow' + feature.panel];
      const root = createRoot(host);
      await act(async () => {root.render(createElement(StrictMode, null, createElement(Component, {documentId: 'first'})));});
      expect(getDocument(host)).toBe('first');
      await act(async () => {root.render(createElement(StrictMode, null, createElement(Component, {documentId: 'second'})));});
      expect(getDocument(host)).toBe('second');
      await act(async () => {root.unmount();});
      expect(host.childElementCount).toBe(0);
      const vue = await import('@elvispdosreis/markflow-' + feature.kind + '/vue');
      const props = reactive({documentId: 'first'});
      const app = createApp({render: () => h(vue['MarkFlow' + feature.panel!], props)});
      app.mount(host); await nextTick();
      expect(getDocument(host)).toBe('first');
      props.documentId = 'second'; await nextTick();
      expect(getDocument(host)).toBe('second');
      app.unmount();
      expect(host.childElementCount).toBe(0);
    });
  });
}

it('shares the calculator class between calibration and measurement extensions', () => {
  const calculator = new MeasurementCalculator();
  const calibration = new CalibrationController(calculator);
  expect(calibration.calibration.linearFactor).toBe(calculator.scaleFactor(50, 'm'));
});

it('exports MarkFlow XML that is still accepted after the legacy deadline', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse(LEGACY_XFDF_EXPIRES_AT) + 1);
  const exported = createXfdf([]);
  expect(exported).toContain('xmlns:markflow="urn:markflow:xfdf:1"');
  expect(parseXfdf(exported).source).toBe('native');
  expect(LEGACY_XFDF_EXPIRES_AT).toBe('2027-10-06T00:00:00-03:00');
});
