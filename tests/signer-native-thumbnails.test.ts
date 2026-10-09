import {afterEach, expect, it, vi} from 'vitest';
import type {PluginRegistry} from '@embedpdf/snippet';
import {createNativeThumbnailDropTarget} from '@elvisreis/markflow-signer';

afterEach(() => document.body.replaceChildren());
it('maps a scrolled/scaled native pane to the public thumbnail virtual window', () => {
  const viewer = document.createElement('div'), root = viewer.attachShadow({mode: 'open'});
  const sidebar = document.createElement('div'); sidebar.dataset.sidebarId = 'sidebar-panel';
  const pane = document.createElement('div'); pane.style.overflowY = 'auto'; pane.scrollTop = 100;
  Object.defineProperty(pane, 'clientHeight', {value: 200});
  Object.defineProperty(pane, 'clientWidth', {value: 90});
  pane.getBoundingClientRect = () => ({left: 10, top: 20, right: 190, bottom: 420, height: 400} as DOMRect);
  sidebar.append(pane); root.append(sidebar); document.body.append(viewer);
  const getWindow = vi.fn(() => ({items: [{pageIndex: 7, top: 200, wrapperHeight: 100, width: 70, height: 80, padding: 5}]}));
  const registry = {getPlugin: () => ({provides: () => ({getWindow})})} as unknown as PluginRegistry;
  const resolve = createNativeThumbnailDropTarget(viewer, registry);
  expect(resolve({x: 50, y: 220})).toEqual({pageIndex: 7, bounds: {left: 30, top: 230, width: 140, height: 160}});
  const row = document.createElement('div'); row.style.position = 'absolute'; row.style.top = '200px';
  const bitmap = document.createElement('img');
  bitmap.getBoundingClientRect = () => ({left: 32, top: 232, width: 136, height: 156} as DOMRect);
  row.append(bitmap); pane.append(row);
  expect(resolve({x: 50, y: 220})).toEqual({pageIndex: 7, bounds: {left: 32, top: 232, width: 136, height: 156}});
  expect(resolve.getPageTarget(7)).toEqual({pageIndex: 7, bounds: {left: 32, top: 232, width: 136, height: 156},
    clipBounds: {left: 10, top: 20, width: 180, height: 400}});
  expect(resolve.getPageTarget(8)).toBeNull();
  expect(resolve({x: 5, y: 220})).toBeNull(); expect(resolve({x: 50, y: 420})).toBeNull();
  sidebar.remove(); expect(resolve({x: 50, y: 220})).toBeNull();
});
it('returns null when the native thumbnail plugin is unavailable', () => {
  const viewer = document.createElement('div');
  const registry = {getPlugin: () => undefined} as unknown as PluginRegistry;
  expect(createNativeThumbnailDropTarget(viewer, registry)({x: 10, y: 10})).toBeNull();
});
