import {afterEach, describe, expect, it, vi} from 'vitest';
import type {PluginRegistry} from '@embedpdf/snippet';
const bridge = vi.hoisted(() => ({base: null as unknown, viewport: null as unknown, geometry: null as unknown}));
vi.mock('@elvisreis/markflow-core', () => ({
  createCrosshairContext: () => bridge.base,
  findViewerViewport: () => bridge.viewport,
  overlayGeometry: () => bridge.geometry
}));
import {mountSignerViewer, SignerState, type SignerViewerOptions} from '@elvisreis/markflow-signer';

afterEach(() => {document.body.replaceChildren(); vi.unstubAllGlobals();});
function fixture() {
  const changes = new Set<() => void>(), closes = new Set<(id: string) => void>();
  const subscribe = (listener: () => void) => {changes.add(listener); return () => changes.delete(listener);};
  let active = 'doc', visible = [0], gated = false, zoom = 1, loading = false, mode = 'pointerMode';
  const pages = [{index: 0, size: {width: 600, height: 800}, rotation: 0},
    {index: 1, size: {width: 600, height: 800}, rotation: 1}];
  const viewer = document.createElement('div'); viewer.attachShadow({mode: 'open'}); document.body.append(viewer);
  const host = document.createElement('div'); document.body.append(host);
  Object.defineProperty(host, 'clientWidth', {value: 900}); Object.defineProperty(host, 'clientHeight', {value: 700});
  host.getBoundingClientRect = () => ({left: 0, top: 0, right: 900, bottom: 700, width: 900, height: 700} as DOMRect);
  const context = {
    getDocument: () => active ? {id: active, scale: zoom, pages} : null,
    getPageRect: (_id: string, index: number) => ({origin: {x: 50, y: index * 850 * zoom}, size: {width: (index ? 800 : 600) * zoom, height: (index ? 600 : 800) * zoom}}),
    getLayout: () => ({pageIndexes: visible}), isGated: () => gated, subscribe
  };
  bridge.base = context; bridge.viewport = document.createElement('div');
  bridge.geometry = {innerLeft: 10, innerTop: 40, right: 890, bottom: 690, originX: 10, originY: 40, sx: 1, sy: 1};
  const documents = {
    getActiveDocumentId: () => active || null,
    getDocumentState: () => active ? {document: {id: active, pages}, rotation: 0, status: loading ? 'loading' : 'loaded'} : null,
    onDocumentOpened: subscribe, onActiveDocumentChanged: subscribe,
    onDocumentClosed: (listener: (id: string) => void) => {closes.add(listener); return () => closes.delete(listener);}
  };
  const scrollToPage = vi.fn();
  const scrollViewport = vi.fn();
  const getPageFormAnnoWidgets = vi.fn((_index: number) => ({toPromise: async () => [] as unknown[]}));
  const registry = {getPlugin: (id: string) => id === 'document-manager' ? {provides: () => documents}
    : id === 'scroll' ? {provides: () => ({forDocument: () => ({scrollToPage})})}
    : id === 'viewport' ? {provides: () => ({forDocument: () => ({getMetrics: () => ({scrollLeft: 0, scrollTop: 100, clientWidth: 900, clientHeight: 700}), scrollTo: scrollViewport})})}
    : id === 'form' ? {provides: () => ({forDocument: () => ({getPageFormAnnoWidgets})})}
    : id === 'interaction-manager' ? {provides: () => ({forDocument: () => ({getActiveMode: () => mode, isPaused: () => false})})}
    : undefined} as unknown as PluginRegistry;
  const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {frames.set(++frameId, callback); return frameId;});
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {frames.delete(id);});
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  const state = new SignerState();
  const options: SignerViewerOptions = {viewer, registry, state};
  const refresh = () => {changes.forEach(listener => listener()); const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0));};
  return {host, viewer, options, state, changes, closes, refresh, scrollToPage, scrollViewport, frames, getPageFormAnnoWidgets,
    visible: (indexes: number[]) => {visible = indexes; refresh();},
    activate: (id: string) => {active = id; refresh();},
    gate: (value: boolean) => {gated = value; refresh();},
    loading: (value: boolean) => {loading = value; refresh();},
    mode: (value: string) => {mode = value; refresh();},
    zoom: (value: number) => {zoom = value; refresh();}};
}

describe('signer snippet viewport integration', () => {
  it('keeps the signature draggable in pan mode while page background passes through to native pan', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    const pageHost = f.host.shadowRoot!.querySelector('.viewport')!.firstElementChild!;
    const root = pageHost.shadowRoot!, box = root.querySelector<HTMLElement>('.signer-box')!;
    const layer = root.querySelector('.layer')!, before = f.state.getSelection();
    expect(layer.classList.contains('enabled')).toBe(true);
    f.mode('panMode');
    expect(layer.classList.contains('enabled')).toBe(true);
    expect(layer.classList.contains('box-only')).toBe(true);
    expect(layer.classList.contains('passive')).toBe(false);
    expect(box.hidden).toBe(false); expect(box.tabIndex).toBe(0);
    const event = new MouseEvent('mousedown', {bubbles: true, cancelable: true});
    box.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    box.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
    expect(f.state.getSelection()!.rect.origin.x).toBe(before!.rect.origin.x + 1);
    f.mode('pointerMode');
    expect(layer.classList.contains('enabled')).toBe(true);
    expect(layer.classList.contains('passive')).toBe(false); expect(box.tabIndex).toBe(0);
    expect(layer.classList.contains('box-only')).toBe(false);
    box.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
    expect(f.state.getSelection()!.rect.origin.x).toBe(before!.rect.origin.x + 2);
    mounted.destroy();
  });
  it('finds a named signature on a non-visible rotated page and uses the exact reserved area', async () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    const rect = {origin: {x: 300, y: 650}, size: {width: 220, height: 60}};
    f.getPageFormAnnoWidgets.mockImplementation(index => ({toPromise: async () => index === 1
      ? [{id: 'widget-1', rect, field: {name: 'elvisreis', type: 7, value: '', flag: 0}}] : []}));
    expect(await mounted.moveToSignatureField(' elvisreis ')).toEqual({status: 'placed', fieldName: 'elvisreis', pageIndex: 1, annotationId: 'widget-1'});
    f.refresh(); f.refresh();
    expect(f.state.getSelection()).toMatchObject({pageIndex: 1, rect, rotation: 0, signatureSize: rect.size});
    expect(f.state.confirm(mounted.context)!.pdfRect).toEqual({x: 300, y: 90, width: 220, height: 60});
    expect(f.state.confirm(mounted.context)!.field).toEqual({name: 'elvisreis', annotationId: 'widget-1'});
    expect(f.scrollToPage).toHaveBeenCalledWith(expect.objectContaining({pageNumber: 2}));
    const before = f.state.getSelection();
    expect(await mounted.moveToSignatureField('missing')).toEqual({status: 'not-found'});
    expect(f.state.getSelection()).toEqual(before); mounted.destroy();
  });
  it.each([
    ['ambiguous', 7, '', 0, true], ['not-signature', 6, '', 0, false],
    ['occupied', 7, 'signed', 0, false], ['occupied', 7, '', 1, false],
    ['invalid-area', 7, '', 0, false]
  ])('preserves placement when the named field is %s', async (status, type, value, flag, duplicate) => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options), before = f.state.getSelection();
    const widget = {id: 'widget', rect: {origin: {x: 20, y: 20}, size: {width: status === 'invalid-area' ? 0 : 220, height: 60}},
      field: {name: 'elvisreis', type, value, flag}};
    f.getPageFormAnnoWidgets.mockImplementation(index => ({toPromise: async () => index === 0 || duplicate ? [widget] : []}));
    expect(await mounted.moveToSignatureField('elvisreis')).toEqual({status});
    expect(f.state.getSelection()).toEqual(before); mounted.destroy();
  });
  it('cancels field lookup if the signature changes while reading', async () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    let resolve!: (value: unknown[]) => void;
    f.getPageFormAnnoWidgets.mockImplementation(() => ({toPromise: () => new Promise<unknown[]>(done => {resolve = done;})}));
    const pending = mounted.moveToSignatureField('elvisreis');
    f.state.clear(); resolve([]);
    expect(await pending).toEqual({status: 'cancelled'});
    expect(f.state.getSelection()).toBeNull(); mounted.destroy();
  });
  it('waits for document loading before revealing the initial coordinates', () => {
    const f = fixture(); f.loading(true);
    const mounted = mountSignerViewer(f.host, {...f.options, initialPosition: {x: 40, y: 60}});
    f.refresh(); expect(f.scrollToPage).not.toHaveBeenCalled();
    expect(f.state.confirm(mounted.context)!.coordinates.margin).toEqual({right: 40, bottom: 60});
    f.loading(false); f.refresh(); expect(f.scrollToPage).toHaveBeenCalledOnce(); mounted.destroy();
  });
  it('explicitly reapplies bottom-right coordinates after removal and refuses invalid replacements', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    f.state.clear();
    expect(mounted.setPosition({x: 40, y: 60, pageIndex: 1})).toBe(true);
    f.refresh(); f.refresh();
    expect(f.state.confirm(mounted.context)!.coordinates.margin).toEqual({right: 40, bottom: 60});
    expect(f.state.getSelection()!.pageIndex).toBe(1);
    expect(f.scrollToPage).toHaveBeenCalledWith(expect.objectContaining({pageNumber: 2}));
    const before = f.state.getSelection();
    expect(mounted.setPosition({x: -1, y: 60})).toBe(false); expect(f.state.getSelection()).toEqual(before);
    expect(mounted.setPosition({x: 10, y: 20})).toBe(true); f.refresh(); f.refresh();
    expect(f.state.confirm(mounted.context)!.coordinates.margin).toEqual({right: 10, bottom: 20});
    mounted.destroy(); expect(mounted.setPosition({x: 40, y: 60})).toBe(false);
  });
  it('initializes coordinates on a non-visible target page and reveals it only once', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, {...f.options, initialPosition: {x: 40, y: 60, pageIndex: 1}});
    expect(f.state.getSelection()!.pageIndex).toBe(1);
    expect(f.state.confirm(mounted.context)!.coordinates.margin).toEqual({right: 40, bottom: 60});
    f.refresh();
    expect(f.scrollToPage).toHaveBeenCalledOnce();
    expect(f.scrollToPage).toHaveBeenCalledWith(expect.objectContaining({pageNumber: 2}));
    f.refresh(); expect(f.scrollToPage).toHaveBeenCalledOnce();
    f.state.clear(); f.visible([1]); expect(f.state.getSelection()).toBeNull(); mounted.destroy();
  });
  it('does not fall back to an arbitrary initial location for invalid coordinates or an unavailable page', () => {
    for (const initialPosition of [{x: -1, y: 60}, {x: 40, y: 999}, {x: 40, y: 60, pageIndex: 9}]) {
      const f = fixture(), mounted = mountSignerViewer(f.host, {...f.options, initialPosition});
      expect(f.state.getSelection()).toBeNull(); expect(f.scrollToPage).not.toHaveBeenCalled(); mounted.destroy();
    }
  });
  it('keeps a draggable signature on the native thumbnail and transfers it to another page', () => {
    const f = fixture();
    const getPageTarget = (pageIndex: number) => ({pageIndex, bounds: pageIndex
      ? {left: -160, top: 200, width: 160, height: 120} : {left: -160, top: 0, width: 120, height: 160}});
    const resolver = Object.assign((point: {x: number; y: number}) => point.x < 0 && point.y >= 200 ? getPageTarget(1) : null,
      {getPageTarget});
    const mounted = mountSignerViewer(f.host, {...f.options, pageDropTarget: resolver}); f.refresh();
    const thumbnail = f.host.shadowRoot!.querySelector<HTMLElement>('.signature-thumbnail')!;
    Object.defineProperty(thumbnail, 'clientWidth', {get: () => parseFloat(thumbnail.style.width)});
    Object.defineProperty(thumbnail, 'clientHeight', {get: () => parseFloat(thumbnail.style.height)});
    thumbnail.getBoundingClientRect = () => ({left: parseFloat(thumbnail.style.left), top: parseFloat(thumbnail.style.top),
      width: parseFloat(thumbnail.style.width), height: parseFloat(thumbnail.style.height)} as DOMRect);
    f.refresh();
    expect(thumbnail.hidden).toBe(false); expect(thumbnail.dataset.pageIndex).toBe('0');
    expect(thumbnail.shadowRoot!.querySelector('.layer')!.classList.contains('box-only')).toBe(true);
    expect((thumbnail.shadowRoot!.querySelector('.rotate') as HTMLElement).hidden).toBe(true);
    const box = thumbnail.shadowRoot!.querySelector('.signer-box')!, layer = thumbnail.shadowRoot!.querySelector('.layer')!;
    const event = (target: Element, type: string, x: number, y: number) => {
      const value = new MouseEvent(type, {bubbles: true, clientX: x, clientY: y, button: 0});
      Object.defineProperty(value, 'pointerId', {value: 1}); target.dispatchEvent(value);
    };
    event(box, 'pointerdown', -100, 13.50882); event(layer, 'pointermove', -80, 260);
    f.refresh(); expect(thumbnail.dataset.pageIndex).toBe('0');
    expect(f.state.getSelection()!.pageIndex).toBe(0);
    event(layer, 'pointerup', -80, 260); f.refresh();
    expect(f.state.getSelection()!.pageIndex).toBe(1); expect(thumbnail.dataset.pageIndex).toBe('1');
    expect(thumbnail.style.height).toBe('120px'); expect(f.scrollToPage).toHaveBeenCalledOnce();
    expect((box as HTMLElement).style.transform).toContain('rotate(90deg)');
    f.state.clear(); f.refresh(); expect(thumbnail.hidden).toBe(true);
    mounted.destroy(); expect(thumbnail.isConnected).toBe(false);
  });
  it('previews the exact thumbnail drop position with destination page orientation, then commits on release', () => {
    const f = fixture();
    const mounted = mountSignerViewer(f.host, {...f.options, pageDropTarget: point => point.x < 0
      ? {pageIndex: 1, bounds: {left: -160, top: 200, width: 160, height: 120}} : null});
    const page = mounted.context.getPage('doc', 0)!;
    f.state.select('doc', page, {origin: {x: 200, y: 200}, size: {width: 200, height: 60}}, 0, {width: 200, height: 60});
    f.state.setRotation(mounted.context, 22.5);
    const before = f.state.getSelection();
    const source = f.host.shadowRoot!.querySelector('.viewport')!.firstElementChild as HTMLElement;
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({left: 60, top: 40, width: 600, height: 800} as DOMRect);
    const box = source.shadowRoot!.querySelector('.signer-box')!, layer = source.shadowRoot!.querySelector('.layer')!;
    const event = (target: Element, type: string, x: number, y: number) => {
      const value = new MouseEvent(type, {bubbles: true, clientX: x, clientY: y, button: 0});
      Object.defineProperty(value, 'pointerId', {value: 1}); target.dispatchEvent(value);
    };
    const preview = f.host.shadowRoot!.querySelector<HTMLElement>('.thumbnail-preview')!;
    event(box, 'pointerdown', 360, 270); event(layer, 'pointermove', -80, 260);
    expect(preview.hidden).toBe(false); expect(preview.dataset.pageIndex).toBe('1');
    expect(preview.style.left).toBe('-160px'); expect(preview.style.width).toBe('160px');
    const miniature = preview.querySelector<HTMLElement>('.thumbnail-signature')!;
    expect(miniature.style.left).toBe('80px'); expect(miniature.style.top).toBe('60px');
    expect(miniature.style.width).toBe('40px'); expect(miniature.style.height).toBe('12px');
    expect(miniature.style.transform).toContain('rotate(112.5deg)');
    expect(f.state.getSelection()).toEqual(before); expect(f.scrollToPage).not.toHaveBeenCalled();
    event(layer, 'pointerup', -80, 260);
    const request = f.state.confirm(mounted.context)!;
    expect(preview.hidden).toBe(true); expect(request.pageIndex).toBe(1);
    expect(request.signatureRotation).toBe(22.5); expect(request.signatureSize).toEqual({width: 200, height: 60});
    expect(request.rect.origin.x + request.rect.size.width / 2).toBeCloseTo(300, 10);
    expect(request.rect.origin.y + request.rect.size.height / 2).toBeCloseTo(400, 10);
    expect(f.scrollToPage).toHaveBeenCalledWith(expect.objectContaining({pageNumber: 2, pageCoordinates: {x: 300, y: 400}}));
    mounted.destroy(); expect(preview.isConnected).toBe(false);
  });
  it('removes the thumbnail preview when leaving or cancelling without committing a transfer', () => {
    const f = fixture();
    const mounted = mountSignerViewer(f.host, {...f.options, pageDropTarget: point => point.x < 0
      ? {pageIndex: 1, bounds: {left: -160, top: 200, width: 160, height: 120}} : null});
    const source = f.host.shadowRoot!.querySelector('.viewport')!.firstElementChild as HTMLElement;
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({left: 60, top: 40, width: 600, height: 800} as DOMRect);
    const box = source.shadowRoot!.querySelector('.signer-box')!, layer = source.shadowRoot!.querySelector('.layer')!;
    const event = (target: Element, type: string, x: number) => {
      const value = new MouseEvent(type, {bubbles: true, clientX: x, clientY: 260, button: 0});
      Object.defineProperty(value, 'pointerId', {value: 1}); target.dispatchEvent(value);
    };
    const before = f.state.getSelection(), preview = f.host.shadowRoot!.querySelector<HTMLElement>('.thumbnail-preview')!;
    event(box, 'pointerdown', 360); event(layer, 'pointermove', -80); expect(preview.hidden).toBe(false);
    event(layer, 'pointermove', -200); // Still inside the row callback, but clamped to the bitmap edge.
    event(layer, 'pointermove', 0); expect(preview.hidden).toBe(true);
    event(layer, 'pointermove', -80); event(layer, 'pointercancel', -80);
    expect(preview.hidden).toBe(true); expect(f.state.getSelection()).toEqual(before);
    expect(f.scrollToPage).not.toHaveBeenCalled(); mounted.destroy();
  });
  it('places on the same page thumbnail and clamps the preview to its edges without resizing', () => {
    const f = fixture();
    const mounted = mountSignerViewer(f.host, {...f.options, pageDropTarget: point => point.x < 0
      ? {pageIndex: 0, bounds: {left: -120, top: 150, width: 120, height: 160}} : null});
    const source = f.host.shadowRoot!.querySelector('.viewport')!.firstElementChild as HTMLElement;
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({left: 60, top: 40, width: 600, height: 800} as DOMRect);
    const original = f.state.getSelection()!;
    const event = (target: Element, type: string, x: number, y: number) => {
      const value = new MouseEvent(type, {bubbles: true, clientX: x, clientY: y, button: 0});
      Object.defineProperty(value, 'pointerId', {value: 1}); target.dispatchEvent(value);
    };
    event(source.shadowRoot!.querySelector('.signer-box')!, 'pointerdown', 360, 107.5441);
    const layer = source.shadowRoot!.querySelector('.layer')!;
    event(layer, 'pointermove', -125, 350);
    const miniature = f.host.shadowRoot!.querySelector<HTMLElement>('.thumbnail-signature')!;
    const previewLeft = parseFloat(miniature.style.left), previewTop = parseFloat(miniature.style.top);
    event(layer, 'pointerup', -125, 350);
    const next = f.state.getSelection()!;
    expect(next.pageIndex).toBe(0); expect(next.rect.size).toEqual(original.rect.size);
    expect(next.rect.origin.x).toBe(0); expect(next.rect.origin.y).toBeCloseTo(800 - next.rect.size.height, 10);
    expect((next.rect.origin.x + next.rect.size.width / 2) * .2).toBeCloseTo(previewLeft, 10);
    expect((next.rect.origin.y + next.rect.size.height / 2) * .2).toBeCloseTo(previewTop, 10);
    expect(f.scrollToPage).toHaveBeenCalledWith(expect.objectContaining({pageNumber: 1})); mounted.destroy();
  });
  it('projects, clips and rescales page mounts without changing PDF coordinates', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    expect(f.state.confirm(mounted.context)?.coordinates.page.number).toBe(1);
    const clip = f.host.shadowRoot!.querySelector('.viewport') as HTMLElement;
    expect(clip.style.top).toBe('40px'); expect(clip.style.height).toBe('650px');
    const pageHost = clip.firstElementChild as HTMLElement;
    expect(pageHost.style.width).toBe('600px'); expect(pageHost.style.left).toBe('50px');
    const before = f.state.confirm(mounted.context); f.zoom(2);
    expect(pageHost.style.width).toBe('1200px'); expect(f.state.confirm(mounted.context)).toEqual(before);
    mounted.destroy();
  });
  it('virtualizes pages and refuses signing after document switches', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    const before = f.state.getSelection(); f.visible([1]);
    expect(f.host.shadowRoot!.querySelector('.viewport')!.childElementCount).toBe(1);
    expect(f.state.getSelection()).toEqual(before);
    f.activate('other'); expect(f.state.getSelection()?.documentId).toBe('other');
    f.activate(''); expect(f.state.confirm(mounted.context)).toBeNull();
    expect(f.host.shadowRoot!.querySelector('.viewport')!.childElementCount).toBe(0);
    mounted.destroy();
  });
  it('hides gated overlays and cleans every subscription on disposal', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    f.gate(true); expect((f.host.shadowRoot!.querySelector('.viewport') as HTMLElement).hidden).toBe(true);
    f.gate(false); expect(f.host.shadowRoot!.querySelector('.viewport')!.childElementCount).toBe(1);
    mounted.destroy(); mounted.destroy(); expect(f.changes.size).toBe(0); expect(f.closes.size).toBe(0);
    expect(f.host.shadowRoot!.childElementCount).toBe(0);
  });
  it('fails clearly if mounted before the viewer is initialized', () => {
    const f = fixture(); bridge.base = null;
    expect(() => mountSignerViewer(f.host, f.options)).toThrow('Initialize the EmbedPDF viewer');
  });
  it('transfers a fixed box to a rotated page and scrolls to the signature', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    const previous = f.state.getSelection()!;
    expect(mounted.moveToPage(1)).toBe(true);
    const next = f.state.confirm(mounted.context)!;
    expect(next.pageIndex).toBe(1);
    expect(next.coordinates.image).toEqual({width: 55, height: 202});
    expect(next.rect.size).toEqual(previous.rect.size);
    expect(next.signatureRotation).toBe(0); // Signature follows the destination's intrinsic rotation.
    expect(f.scrollToPage).toHaveBeenCalledWith(expect.objectContaining({pageNumber: 2, alignY: 50, behavior: 'instant'}));
    expect(mounted.moveToPage(9)).toBe(false);
    f.state.setEnabled(false); expect(mounted.moveToPage(0)).toBe(false);
    mounted.destroy();
  });
  it('keeps a 22.5 degree signature orientation and actual dimensions across rotated pages', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options);
    f.state.setRotation(mounted.context, 22.5);
    const previous = f.state.confirm(mounted.context)!;
    expect(mounted.moveToPage(1)).toBe(true);
    const next = f.state.confirm(mounted.context)!;
    expect(next.signatureRotation).toBe(22.5);
    expect(next.signatureSize).toEqual(previous.signatureSize);
    expect(next.rect.size.width).toBeCloseTo(previous.rect.size.width, 10);
    expect(next.rect.size.height).toBeCloseTo(previous.rect.size.height, 10);
    expect(f.scrollToPage).toHaveBeenCalledWith(expect.objectContaining({pageNumber: 2}));
    mounted.destroy();
  });
  it('drags to a sidebar target while preserving capture through virtualization', () => {
    const f = fixture();
    const mounted = mountSignerViewer(f.host, {...f.options, pageDropTarget: point => point.x < 0 ? 1 : null});
    const source = f.host.shadowRoot!.querySelector('.viewport')!.firstElementChild as HTMLElement;
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({left: 60, top: 40, width: 600, height: 800} as DOMRect);
    const box = source.shadowRoot!.querySelector('.signer-box')!, layer = source.shadowRoot!.querySelector('.layer')!;
    const event = (target: Element, type: string, x: number, y: number) => {
      const event = new MouseEvent(type, {bubbles: true, clientX: x, clientY: y, button: 0});
      Object.defineProperty(event, 'pointerId', {value: 1}); target.dispatchEvent(event);
    };
    event(box, 'pointerdown', 360, 100); event(layer, 'pointermove', -20, 200);
    expect(f.state.getSelection()?.pageIndex).toBe(0); expect(f.scrollToPage).not.toHaveBeenCalled();
    f.visible([1]); expect(source.isConnected).toBe(true);
    event(layer, 'pointerup', -20, 200);
    expect(f.state.getSelection()?.pageIndex).toBe(1); expect(f.scrollToPage).toHaveBeenCalledOnce(); f.refresh();
    expect(source.isConnected).toBe(false); mounted.destroy(); expect(f.frames.size).toBe(0);
  });
  it('scrolls near the viewport edge during capture and stops on cancellation', () => {
    const f = fixture(), mounted = mountSignerViewer(f.host, f.options), previous = f.state.getSelection();
    const source = f.host.shadowRoot!.querySelector('.viewport')!.firstElementChild as HTMLElement;
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({left: 60, top: 40, width: 600, height: 800} as DOMRect);
    const box = source.shadowRoot!.querySelector('.signer-box')!, layer = source.shadowRoot!.querySelector('.layer')!;
    const event = (target: Element, type: string, y: number) => {
      const event = new MouseEvent(type, {bubbles: true, clientX: 360, clientY: y, button: 0});
      Object.defineProperty(event, 'pointerId', {value: 1}); target.dispatchEvent(event);
    };
    event(box, 'pointerdown', 100); event(layer, 'pointermove', 680); f.refresh();
    expect(f.scrollViewport).toHaveBeenCalledWith({x: 0, y: 112, behavior: 'instant'});
    event(layer, 'pointercancel', 680); expect(f.state.getSelection()).toEqual(previous);
    f.scrollViewport.mockClear(); f.refresh(); expect(f.scrollViewport).not.toHaveBeenCalled();
    mounted.destroy(); expect(f.frames.size).toBe(0);
  });
  it('drags directly across the gap to another visible page at 50% zoom', () => {
    const f = fixture(); f.zoom(.5); f.visible([0, 1]);
    const mounted = mountSignerViewer(f.host, f.options);
    const source = f.host.shadowRoot!.querySelector('.viewport')!.firstElementChild as HTMLElement;
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({left: 60, top: 40, width: 300, height: 400} as DOMRect);
    const box = source.shadowRoot!.querySelector('.signer-box')!, layer = source.shadowRoot!.querySelector('.layer')!;
    const event = (target: Element, type: string, y: number) => {
      const event = new MouseEvent(type, {bubbles: true, clientX: 210, clientY: y, button: 0});
      Object.defineProperty(event, 'pointerId', {value: 1}); target.dispatchEvent(event);
    };
    event(box, 'pointerdown', 70); event(layer, 'pointermove', 540); event(layer, 'pointerup', 540);
    const request = f.state.confirm(mounted.context)!;
    expect(request.pageIndex).toBe(1); expect(request.coordinates.image).toEqual({width: 55, height: 202});
    expect(request.signatureRotation).toBe(0);
    expect(f.scrollToPage).not.toHaveBeenCalled(); mounted.destroy();
  });
  it('follows page rotation during direct dragging in both directions while preserving a 22.5 degree signature angle', () => {
    const f = fixture(); f.zoom(.5); f.visible([0, 1]);
    const mounted = mountSignerViewer(f.host, f.options), page = mounted.context.getPage('doc', 0)!;
    f.state.select('doc', page, {origin: {x: 200, y: 200}, size: {width: 200, height: 60}}, 0, {width: 200, height: 60});
    f.state.setRotation(mounted.context, 22.5);
    const source = f.host.shadowRoot!.querySelector('.viewport')!.firstElementChild as HTMLElement;
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({left: 60, top: 40, width: 300, height: 400} as DOMRect);
    const layer = source.shadowRoot!.querySelector('.layer')!;
    const event = (target: Element, type: string, y: number) => {
      const value = new MouseEvent(type, {bubbles: true, clientX: 210, clientY: y, button: 0});
      Object.defineProperty(value, 'pointerId', {value: 1}); target.dispatchEvent(value);
    };
    event(source.shadowRoot!.querySelector('.signer-box')!, 'pointerdown', 155);
    event(layer, 'pointermove', 540); f.refresh();
    const target = f.host.shadowRoot!.querySelector('.viewport')!.children[1] as HTMLElement;
    expect(f.state.getSelection()!.pageIndex).toBe(1);
    expect(f.state.confirm(mounted.context)!.signatureRotation).toBe(22.5);
    expect((target.shadowRoot!.querySelector('.signer-box') as HTMLElement).style.transform).toContain('rotate(112.5deg)');
    event(layer, 'pointermove', 155); f.refresh();
    expect(f.state.getSelection()!.pageIndex).toBe(0);
    expect((source.shadowRoot!.querySelector('.signer-box') as HTMLElement).style.transform).toContain('rotate(22.5deg)');
    event(layer, 'pointerup', 155);
    expect(f.state.getSelection()!.signatureSize).toEqual({width: 200, height: 60});
    mounted.destroy();
  });
});
