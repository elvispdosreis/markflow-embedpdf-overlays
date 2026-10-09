import {afterEach, describe, expect, it, vi} from 'vitest';
import {createElement, act, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {createApp, createSSRApp, h, markRaw, nextTick, shallowReactive} from 'vue';
import {renderToString as renderVue} from '@vue/server-renderer';
import {SignerState, mountSigner, signatureCoordinates, rotateRect, restoreRect, registerSignerElement, signatureRectFromBottomRight,
  type SignaturePage, type SignerContext, type SignerOptions, type SignerElement} from '@elvisreis/markflow-signer';
import {MarkFlowSigner} from '@elvisreis/markflow-signer/react';
import {MarkFlowSigner as VueSigner} from '@elvisreis/markflow-signer/vue';

afterEach(() => {document.body.replaceChildren(); vi.restoreAllMocks();});
const rect = {origin: {x: 40.4, y: 50.4}, size: {width: 100.4, height: 60.4}};
function fixture(rotation: 0 | 1 | 2 | 3 = 0, zoom = 1) {
  const state = new SignerState();
  const page: SignaturePage = {index: 0, size: {width: 600, height: 800}, rotation};
  let active = true;
  const listeners = new Set<() => void>(), closes = new Set<(id: string) => void>();
  const context: SignerContext = {
    getPage: (id, index) => active && id === 'doc' && [0, 1].includes(index) ? {...page, index} : null,
    subscribe: listener => {listeners.add(listener); return () => listeners.delete(listener);},
    onDocumentClosed: listener => {closes.add(listener); return () => closes.delete(listener);}
  };
  const host = document.createElement('div'); document.body.append(host);
  const width = (rotation % 2 ? 800 : 600) * zoom, height = (rotation % 2 ? 600 : 800) * zoom;
  Object.defineProperty(host, 'clientWidth', {value: width});
  Object.defineProperty(host, 'clientHeight', {value: height});
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({x: 100, y: 100, left: 100, top: 100,
    right: 100 + width, bottom: 100 + height, width, height, toJSON() {return {};}});
  const options: SignerOptions = {state, context, documentId: 'doc', pageIndex: 0, hostSpace: 'rotated-page', autoPlace: false, resizable: true};
  const event = (target: Element, type: string, x: number, y: number, pointerId = 1) => {
    const value = new MouseEvent(type, {bubbles: true, cancelable: true, clientX: 100 + x * zoom, clientY: 100 + y * zoom, button: 0});
    Object.defineProperty(value, 'pointerId', {value: pointerId}); target.dispatchEvent(value);
  };
  return {state, page, context, host, options, event, listeners, closes,
    deactivate: () => {active = false; listeners.forEach(listener => listener());}};
}

describe('signer coordinates', () => {
  it.each([0, 1, 2, 3] as const)('converts bottom-right margins at intrinsic rotation %i independently of viewer rotation', rotation => {
    const page: SignaturePage = {index: 0, size: {width: 600, height: 800}, rotation, viewRotation: 1};
    const placed = signatureRectFromBottomRight({x: 40.25, y: 60.5}, {width: 202, height: 55}, page)!;
    const visual = rotateRect(placed, page.size, rotation), bounds = rotation % 2 ? {width: 800, height: 600} : page.size;
    expect(bounds.width - visual.origin.x - visual.size.width).toBe(40.25);
    expect(bounds.height - visual.origin.y - visual.size.height).toBe(60.5);
    expect(signatureCoordinates(placed, page)!.margin).toEqual({right: 40, bottom: 61});
  });
  it('rejects invalid or out-of-page initial margins', () => {
    const page: SignaturePage = {index: 0, size: {width: 600, height: 800}, rotation: 0};
    for (const x of [-1, NaN, Infinity, 500]) expect(signatureRectFromBottomRight({x, y: 60}, {width: 202, height: 55}, page)).toBeNull();
    expect(signatureRectFromBottomRight({x: 0, y: 0}, {width: 202, height: 55}, page)!.origin).toEqual({x: 398, y: 745});
  });
  it.each([
    [0, 459, 689, 100, 60, 600, 800],
    [1, 50, 459, 60, 100, 800, 600],
    [2, 40, 50, 100, 60, 600, 800],
    [3, 689, 40, 60, 100, 800, 600]
  ] as const)('matches StampCoordinates for rotation %i', (rotation, right, bottom, width, height, pageWidth, pageHeight) => {
    expect(signatureCoordinates(rect, {index: 1, size: {width: 600, height: 800}, rotation})).toEqual({
      margin: {right, bottom}, image: {width, height}, page: {number: 2, width: pageWidth, height: pageHeight, rotation: rotation * 90}
    });
  });
  it('preserves the C# signer rectangle on a 270-degree page', () => {
    expect(signatureCoordinates({origin: {x: 55, y: 1336}, size: {width: 130, height: 362}},
      {index: 0, size: {width: 1296, height: 1728}, rotation: 3})).toEqual({
      margin: {right: 30, bottom: 55}, image: {width: 362, height: 130}, page: {number: 1, width: 1728, height: 1296, rotation: 270}
    });
  });
  it.each([0, 1, 2, 3] as const)('round-trips full precision at rotation %i', rotation => {
    const restored = restoreRect(rotateRect(rect, {width: 600, height: 800}, rotation), {width: 600, height: 800}, rotation);
    expect(restored.origin.x).toBeCloseTo(rect.origin.x, 10); expect(restored.origin.y).toBeCloseTo(rect.origin.y, 10);
    expect(restored.size).toEqual(rect.size);
  });
  it.each([NaN, Infinity, -1, 0])('rejects invalid dimensions %s', width => {
    expect(signatureCoordinates({...rect, size: {...rect.size, width}}, {index: 0, size: {width: 600, height: 800}, rotation: 0})).toBeNull();
  });
  it('rejects out-of-page areas and invalid rotations', () => {
    const page = {index: 0, size: {width: 600, height: 800}, rotation: 0 as const};
    expect(signatureCoordinates({...rect, origin: {x: 590, y: 0}}, page)).toBeNull();
    expect(signatureCoordinates(rect, {...page, rotation: 4 as never})).toBeNull();
  });
});

describe('signer interaction and lifecycle', () => {
  it.each([0, 1, 2, 3] as const)('automatically positions once at bottom-right margins on page rotation %i', rotation => {
    const f = fixture(rotation, 2), mounted = mountSigner(f.host, {...f.options, autoPlace: true, initialPosition: {x: 40, y: 60}});
    expect(f.state.confirm(f.context)!.coordinates.margin).toEqual({right: 40, bottom: 60});
    expect(f.state.confirm(f.context)!.coordinates.image).toEqual({width: 202, height: 55});
    f.state.clear(); mounted.update(); expect(f.state.getSelection()).toBeNull(); mounted.destroy();
  });
  it('snaps all sixteen orientations without accumulating size changes', () => {
    const f = fixture(); const size = {width: 202, height: 55};
    f.state.select('doc', f.page, {origin: {x: 200, y: 300}, size});
    for (let step = 1; step <= 16; step++) {
      expect(f.state.rotate(f.context)).toBe(true);
      const request = f.state.confirm(f.context)!;
      const degrees = step * 22.5 % 360, radians = degrees * Math.PI / 180;
      expect(request.signatureRotation).toBe(degrees);
      expect(request.signatureSize).toEqual(size);
      expect(request.rect.size.width).toBeCloseTo(202 * Math.abs(Math.cos(radians)) + 55 * Math.abs(Math.sin(radians)), 10);
      expect(request.rect.size.height).toBeCloseTo(202 * Math.abs(Math.sin(radians)) + 55 * Math.abs(Math.cos(radians)), 10);
      expect(request.rect.origin.x + request.rect.size.width / 2).toBeCloseTo(301, 10);
    }
    expect(f.state.getSelection()!.rect.size).toEqual(size);
    expect(f.state.setRotation(f.context, 39)).toBe(true);
    expect(f.state.confirm(f.context)!.signatureRotation).toBe(45);
  });
  it('drags the rotation handle in snapped steps and restores a cancelled gesture', () => {
    const f = fixture(); const mounted = mountSigner(f.host, f.options);
    f.state.select('doc', f.page, {origin: {x: 200, y: 300}, size: {width: 202, height: 55}});
    const button = f.host.shadowRoot!.querySelector<HTMLButtonElement>('.rotate')!;
    const before = f.state.getSelection();
    f.event(button, 'pointerdown', 301, 265);
    f.event(button, 'pointermove', 401, 227.5);
    expect(f.state.confirm(f.context)!.signatureRotation).toBe(45);
    expect((f.host.shadowRoot!.querySelector('.angle') as HTMLElement).hidden).toBe(false);
    f.event(button, 'pointercancel', 401, 227.5);
    expect(f.state.getSelection()).toEqual(before);
    f.event(button, 'pointerdown', 301, 265);
    f.event(button, 'pointermove', 401, 227.5);
    f.event(button, 'pointerup', 401, 227.5); button.click();
    expect(f.state.confirm(f.context)!.signatureRotation).toBe(45);
    expect((f.host.shadowRoot!.querySelector('.angle') as HTMLElement).hidden).toBe(true);
    mounted.destroy();
  });
  it.each([0, 1, 2, 3] as const)('rotates from the box without dragging at page rotation %i', rotation => {
    const f = fixture(rotation, 0.5), onDrag = vi.fn();
    const mounted = mountSigner(f.host, {...f.options, autoPlace: true, onDrag});
    const button = f.host.shadowRoot!.querySelector<HTMLButtonElement>('.rotate')!;
    expect(button.getAttribute('aria-label')).toBe('Girar assinatura');
    expect(button.style.transform).toBe('rotate(0deg)');
    const before = f.state.getSelection()!;
    f.event(button, 'pointerdown', 300, 40);
    f.event(f.host.shadowRoot!.querySelector('.layer')!, 'pointermove', 500, 500);
    f.event(button, 'pointerup', 500, 500);
    expect(f.state.getSelection()).toEqual(before); expect(onDrag).not.toHaveBeenCalled();
    button.click();
    expect(f.state.getSelection()!.rotation).toBe(((before.rotation ?? 0) + 0.25) % 4);
    expect(f.state.getSelection()!.pageIndex).toBe(0);
    f.state.setEnabled(false); button.click();
    expect(f.state.getSelection()!.rotation).toBe(((before.rotation ?? 0) + 0.25) % 4);
    mounted.destroy(); button.click();
    expect(f.state.getSelection()!.rotation).toBe(((before.rotation ?? 0) + 0.25) % 4);
  });
  it('uses a fixed size by default and displays no resize grip', () => {
    const f = fixture(), mounted = mountSigner(f.host, {...f.options, resizable: undefined, autoPlace: true});
    expect((f.host.shadowRoot!.querySelector('.resize') as HTMLElement).hidden).toBe(true);
    const before = f.state.getSelection()!.rect.size;
    const box = f.host.shadowRoot!.querySelector('.signer-box')!, layer = f.host.shadowRoot!.querySelector('.layer')!;
    f.event(box, 'pointerdown', 300, 60); f.event(layer, 'pointerup', 450, 300);
    expect(f.state.getSelection()!.rect.size).toEqual(before); mounted.destroy();
  });
  it.each([0, 1, 2, 3] as const)('places and drags in PDF units at 200%% zoom with rotation %i', rotation => {
    const f = fixture(rotation, 2), mounted = mountSigner(f.host, f.options);
    const layer = f.host.shadowRoot!.querySelector('.layer')!;
    f.event(layer, 'pointerdown', 250, 250); f.event(layer, 'pointerup', 250, 250);
    const before = rotateRect(f.state.getSelection()!.rect, f.page.size, rotation);
    expect(before.origin.x).toBeCloseTo(250 - 201.99 / 2); expect(before.origin.y).toBeCloseTo(250 - 55.0882 / 2);
    const box = f.host.shadowRoot!.querySelector('.signer-box')!;
    f.event(box, 'pointerdown', 250, 250); f.event(layer, 'pointermove', 300, 275); f.event(layer, 'pointerup', 300, 275);
    const after = rotateRect(f.state.getSelection()!.rect, f.page.size, rotation);
    expect(after.origin.x - before.origin.x).toBeCloseTo(50); expect(after.origin.y - before.origin.y).toBeCloseTo(25);
    expect(after.size.width).toBeCloseTo(201.99); expect(after.size.height).toBeCloseTo(55.0882);
    // A rotated portrait area must resize from its visible grip without recentering.
    f.state.select('doc', f.page, rect);
    const beforeResize = rotateRect(rect, f.page.size, rotation);
    const handle = f.host.shadowRoot!.querySelector('.resize')!;
    const corner = {x: beforeResize.origin.x + beforeResize.size.width, y: beforeResize.origin.y + beforeResize.size.height};
    f.event(handle, 'pointerdown', corner.x, corner.y);
    f.event(layer, 'pointerup', corner.x + 20, corner.y + 10);
    const resized = rotateRect(f.state.getSelection()!.rect, f.page.size, rotation);
    expect(resized.origin.x).toBeCloseTo(beforeResize.origin.x); expect(resized.origin.y).toBeCloseTo(beforeResize.origin.y);
    expect(resized.size.width).toBeCloseTo(beforeResize.size.width + 20); expect(resized.size.height).toBeCloseTo(beforeResize.size.height + 10);
    mounted.destroy();
  });
  it('clamps placement and resize to the page and supports keyboard movement', () => {
    const f = fixture(), mounted = mountSigner(f.host, f.options);
    const layer = f.host.shadowRoot!.querySelector('.layer')!;
    f.event(layer, 'pointerdown', 599, 799); f.event(layer, 'pointerup', 599, 799);
    let selection = f.state.getSelection()!;
    expect(selection.rect.origin.x + selection.rect.size.width).toBeCloseTo(600);
    const box = f.host.shadowRoot!.querySelector('.signer-box')!;
    box.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', shiftKey: true, bubbles: true}));
    expect(f.state.getSelection()!.rect.origin.x).toBeCloseTo(selection.rect.origin.x - 10);
    const handle = f.host.shadowRoot!.querySelector('.resize')!;
    f.event(handle, 'pointerdown', 599, 799); f.event(layer, 'pointermove', 900, 900); f.event(layer, 'pointerup', 900, 900);
    selection = f.state.getSelection()!;
    expect(selection.rect.origin.x + selection.rect.size.width).toBeCloseTo(600);
    expect(selection.rect.origin.y + selection.rect.size.height).toBeCloseTo(800);
    mounted.destroy();
  });
  it('rolls back cancellation, disables input and guards against stale signing', () => {
    const f = fixture(), mounted = mountSigner(f.host, f.options);
    f.state.select('doc', f.page, rect);
    const box = f.host.shadowRoot!.querySelector('.signer-box')!, layer = f.host.shadowRoot!.querySelector('.layer')!;
    f.event(box, 'pointerdown', 60, 70); f.event(layer, 'pointermove', 150, 150); f.event(layer, 'pointercancel', 150, 150);
    expect(f.state.getSelection()!.rect).toEqual(rect);
    f.state.setEnabled(false); f.event(layer, 'pointerdown', 500, 500); expect(f.state.getSelection()!.rect).toEqual(rect);
    expect(f.state.confirm(f.context)).toBeNull();
    f.state.setEnabled(true);
    expect(f.state.confirm(f.context)?.pdfRect).toEqual({x: 40.4, y: 689.2, width: 100.4, height: 60.4});
    f.deactivate(); expect(f.state.confirm(f.context)).toBeNull();
    expect((f.host.shadowRoot!.querySelector('.position') as HTMLElement).hidden).toBe(true);
    mounted.destroy(); mounted.destroy();
    expect(f.listeners.size).toBe(0); expect(f.closes.size).toBe(0); expect(f.host.shadowRoot!.childElementCount).toBe(0);
  });
  it('shows the initial box once and keeps it removed after Escape or virtualization', () => {
    const f = fixture(); let mounted = mountSigner(f.host, {...f.options, autoPlace: true});
    expect(f.state.getSelection()).not.toBeNull();
    f.host.shadowRoot!.querySelector('.signer-box')!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    mounted.update(); expect(f.state.getSelection()).toBeNull();
    mounted.destroy(); mounted = mountSigner(f.host, {...f.options, autoPlace: true});
    expect(f.state.getSelection()).toBeNull(); mounted.destroy();
  });
  it('ignores clicks on another page and closes the original selection', () => {
    const f = fixture(), mounted = mountSigner(f.host, f.options);
    f.state.select('doc', f.page, rect);
    const currentLayer = f.host.shadowRoot!.querySelector('.layer')!;
    f.event(currentLayer, 'pointerdown', 500, 500); f.event(currentLayer, 'pointerup', 500, 500);
    expect(f.state.getSelection()!.rect).toEqual(rect);
    mounted.update({...f.options, pageIndex: 1});
    const layer = f.host.shadowRoot!.querySelector('.layer')!;
    f.event(layer, 'pointerdown', 100, 100); f.event(layer, 'pointerup', 100, 100);
    expect(f.state.confirm(f.context)?.coordinates.page.number).toBe(1);
    f.closes.forEach(listener => listener('doc')); expect(f.state.getSelection()).toBeNull(); mounted.destroy();
  });
  it('isolates returned data and ignores temporary viewer rotation in the signing contract', () => {
    const f = fixture(); f.state.select('doc', f.page, rect);
    const first = f.state.confirm(f.context)!;
    first.rect.origin.x = 900; expect(f.state.getSelection()!.rect.origin.x).toBe(40.4);
    const before = f.state.confirm(f.context); f.page.viewRotation = 1;
    expect(f.state.confirm(f.context)).toEqual(before);
  });
  it('rotates the fixed signature through four orientations and preserves the signing angle', () => {
    const f = fixture(), mounted = mountSigner(f.host, f.options);
    const original = {origin: {x: 100, y: 150}, size: {width: 202, height: 55}};
    f.state.select('doc', f.page, original);
    for (const angle of [90, 180, 270, 0]) {
      expect(f.state.setRotation(f.context, angle)).toBe(true);
      const request = f.state.confirm(f.context)!;
      expect(request.signatureRotation).toBe(angle);
      expect(request.rect.size).toEqual(angle % 180 ? {width: 55, height: 202} : original.size);
      expect(request.rect.origin.x + request.rect.size.width / 2).toBe(201);
      expect(request.rect.origin.y + request.rect.size.height / 2).toBe(177.5);
      expect((f.host.shadowRoot!.querySelector('.signer-box') as HTMLElement).style.transform).toContain(`rotate(${angle}deg)`);
    }
    expect(f.state.getSelection()!.rect).toEqual(original);
    f.state.rotate(f.context, -1); expect(f.state.confirm(f.context)?.signatureRotation).toBe(337.5);
    const before = f.state.confirm(f.context); f.page.viewRotation = 1; expect(f.state.confirm(f.context)).toEqual(before);
    mounted.destroy();
  });
  it('clamps rotation near an edge without resizing and refuses invalid rotations', () => {
    const f = fixture();
    f.state.select('doc', f.page, {origin: {x: 0, y: 0}, size: {width: 202, height: 55}});
    expect(f.state.setRotation(f.context, 90)).toBe(true);
    expect(f.state.getSelection()!.rect).toEqual({origin: {x: 73.5, y: 0}, size: {width: 55, height: 202}});
    f.state.setEnabled(false); expect(f.state.rotate(f.context)).toBe(false);
    f.state.setEnabled(true); f.deactivate(); expect(f.state.rotate(f.context)).toBe(false);
    const other = fixture(); other.state.select('doc', other.page, {origin: {x: 0, y: 0}, size: {width: 100, height: 700}});
    expect(other.state.setRotation(other.context, 90)).toBe(false);
    expect(other.state.select('doc', other.page, rect, 4 as never)).toBe(false);
  });
  it('supports Angular property binding and disconnect/reconnect without duplicated listeners', () => {
    registerSignerElement(); registerSignerElement();
    const f = fixture(), element = document.createElement('markflow-signer') as SignerElement;
    element.options = f.options; document.body.append(element);
    expect(f.listeners.size).toBe(1); element.remove(); expect(f.listeners.size).toBe(0);
    document.body.append(element); expect(f.listeners.size).toBe(1);
    element.options = undefined; expect(f.listeners.size).toBe(0); element.remove();
  });
});

describe('signer framework adapters', () => {
  it('renders SSR hosts for React and Vue', async () => {
    const f = fixture();
    expect(renderToString(createElement(MarkFlowSigner, {options: f.options}))).toContain('data-markflow-overlay="signer"');
    expect(await renderVue(createSSRApp({render: () => h(VueSigner, {options: f.options})}))).toContain('data-markflow-overlay="signer"');
  });
  it('updates and cleans up React StrictMode and Vue mounts', async () => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
    const f = fixture(), root = createRoot(f.host);
    await act(async () => root.render(createElement(StrictMode, null, createElement(MarkFlowSigner, {options: f.options}))));
    expect(f.listeners.size).toBe(1);
    const nativeHost = f.host.querySelector('div')!;
    expect(nativeHost.shadowRoot!.querySelector('.signer-box')).not.toBeNull();
    await act(async () => root.render(createElement(MarkFlowSigner, {options: {...f.options, title: 'Assinatura digital'}})));
    f.state.select('doc', f.page, rect);
    expect(f.host.querySelector('div')!.shadowRoot!.querySelector('strong')!.textContent).toBe('Assinatura digital');
    await act(async () => root.unmount()); expect(f.listeners.size).toBe(0);
    const props = shallowReactive({options: markRaw(f.options)});
    const app = createApp({render: () => h(VueSigner, props)}); app.mount(f.host); await nextTick();
    props.options = markRaw({...f.options, title: 'Assinatura Vue'}); await nextTick();
    expect(f.host.querySelector('div')!.shadowRoot!.querySelector('strong')!.textContent).toBe('Assinatura Vue');
    app.unmount(); expect(f.listeners.size).toBe(0);
  });
});
