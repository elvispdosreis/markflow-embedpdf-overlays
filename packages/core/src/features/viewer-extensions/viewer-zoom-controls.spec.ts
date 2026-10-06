import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mountViewerZoomControls, type ViewerZoomControlsOptions} from './viewer-zoom-controls';

describe('Viewer zoom controls', () => {
  let host: HTMLElement;
  let root: ShadowRoot;
  let viewport: HTMLElement;
  let toolbar: HTMLElement;
  let level: number;
  let documentId: string;
  let requestZoom: ReturnType<typeof vi.fn>;
  let nativeWheel: ReturnType<typeof vi.fn<() => void>>;
  let dispose: () => void;
  let setup: () => void;
  let step: number | undefined;
  let wheelIdleMs: number | undefined;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = host.attachShadow({mode: 'open'});
    viewport = document.createElement('div');
    viewport.style.overflow = 'auto';
    Object.defineProperties(viewport, {clientWidth: {value: 800}, clientHeight: {value: 600}});
    toolbar = document.createElement('div');
    root.append(toolbar, viewport);
    level = 1;
    documentId = 'doc';
    requestZoom = vi.fn((value: number) => {level = Math.min(8, Math.max(0.2, value));});
    const capabilities = {
      zoom: {forDocument: () => ({getState: () => ({currentZoomLevel: level}), requestZoom})},
      'document-manager': {getActiveDocumentId: () => documentId}
    };
    step = undefined; wheelIdleMs = undefined;
    setup = () => {
      dispose?.();
      dispose = mountViewerZoomControls({
        root, viewer: host, zoom: capabilities.zoom,
        getViewport: () => viewport, getActiveDocumentId: () => documentId, step, wheelIdleMs
      } as unknown as ViewerZoomControlsOptions);
    };
    setup();
    nativeWheel = vi.fn();
    viewport.addEventListener('wheel', nativeWheel);
  });

  afterEach(() => {
    dispose();
    host.remove();
  });

  function wheel(deltaY: number, time: number, options: WheelEventInit = {ctrlKey: true}, target = viewport) {
    const event = new WheelEvent('wheel', {bubbles: true, composed: true, cancelable: true, deltaY, ...options});
    Object.defineProperty(event, 'timeStamp', {value: time});
    target.dispatchEvent(event);
    return event;
  }

  it('preserves ordinary mouse/trackpad scrolling and wheel outside the viewport', () => {
    expect(wheel(120, 0, {}).defaultPrevented).toBe(false);
    expect(nativeWheel).toHaveBeenCalledOnce();
    expect(wheel(-120, 200, {ctrlKey: true}, toolbar).defaultPrevented).toBe(false);
    expect(requestZoom).not.toHaveBeenCalled();
  });

  it.each([{ctrlKey: true}, {metaKey: true}])('steps up and down with modifier %j and preserves the pointer anchor', options => {
    expect(wheel(-120, 0, {...options, clientX: 200, clientY: 300}).defaultPrevented).toBe(true);
    expect(requestZoom).toHaveBeenLastCalledWith(1.2, {vx: 200, vy: 300});
    wheel(-120, 200, options);
    expect(level).toBe(1.4);
    wheel(120, 210, options);
    expect(level).toBe(1.2);
    expect(nativeWheel).not.toHaveBeenCalled();
  });

  it('groups a continuous burst using the native 150ms idle boundary', () => {
    wheel(-120, 0);
    wheel(-30, 80);
    wheel(-3, 160);
    expect(requestZoom).toHaveBeenCalledOnce();
    expect(level).toBe(1.2);
    wheel(-120, 310);
    expect(level).toBe(1.4);
  });

  it('accepts a shared custom zoom step and wheel idle boundary', () => {
    step = 0.1; wheelIdleMs = 250; setup();
    wheel(-120, 0);
    wheel(-120, 200);
    expect(level).toBe(1.1);
    wheel(-120, 450);
    expect(level).toBe(1.2);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: '-', ctrlKey: true, bubbles: true, cancelable: true}));
    expect(level).toBe(1.1);
  });

  it('reads fresh zoom and document state after toolbar changes or document replacement', () => {
    wheel(-120, 0);
    level = 1.37;
    wheel(-120, 200);
    expect(level).toBe(1.57);
    documentId = 'other-doc';
    level = 2;
    wheel(-120, 210);
    expect(level).toBe(2.2);
  });

  it('delegates clamping at both configured limits to the official zoom API', () => {
    level = 7.95;
    wheel(-120, 0);
    expect(requestZoom).toHaveBeenLastCalledWith(8.15, expect.any(Object));
    expect(level).toBe(8);
    level = 0.25;
    wheel(120, 200);
    expect(requestZoom).toHaveBeenLastCalledWith(0.05, expect.any(Object));
    expect(level).toBe(0.2);
  });

  it('leaves touch pinch and horizontal wheel untouched', () => {
    const touch = new Event('touchmove', {bubbles: true, cancelable: true});
    const nativeTouch = vi.fn();
    viewport.addEventListener('touchmove', nativeTouch);
    viewport.dispatchEvent(touch);
    expect(nativeTouch).toHaveBeenCalledOnce();
    expect(touch.defaultPrevented).toBe(false);
    expect(wheel(0, 0, {ctrlKey: true, deltaX: 100}).defaultPrevented).toBe(false);
    expect(requestZoom).not.toHaveBeenCalled();
  });

  it('does not duplicate listeners on setup and removes them on abort', () => {
    setup();
    wheel(-120, 0);
    expect(requestZoom).toHaveBeenCalledOnce();
    dispose();
    expect(wheel(-120, 200).defaultPrevented).toBe(false);
    expect(requestZoom).toHaveBeenCalledOnce();
    expect(nativeWheel).toHaveBeenCalledOnce();
  });

  it.each([
    {key: '+', ctrlKey: true}, {key: '=', ctrlKey: true},
    {key: '+', metaKey: true}, {key: '+', code: 'NumpadAdd', ctrlKey: true}
  ])('routes browser zoom shortcut %j to the plant only', options => {
    const nativeShortcut = vi.fn();
    viewport.addEventListener('keydown', nativeShortcut);
    const event = new KeyboardEvent('keydown', {...options, bubbles: true, composed: true, cancelable: true});
    viewport.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(level).toBe(1.2);
    expect(requestZoom).toHaveBeenCalledOnce();
    expect(nativeShortcut).not.toHaveBeenCalled();
  });

  it.each([
    {key: '-', ctrlKey: true}, {key: '-', metaKey: true},
    {key: '_', ctrlKey: true}, {key: '-', code: 'NumpadSubtract', ctrlKey: true}
  ])('reduces plant zoom by 20 percentage points with %j', options => {
    const event = new KeyboardEvent('keydown', {...options, bubbles: true, cancelable: true});
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(level).toBe(0.8);
  });

  it('blocks browser zoom on key repeat without applying repeated plant steps', () => {
    const event = new KeyboardEvent('keydown', {key: '+', ctrlKey: true, repeat: true, bubbles: true, cancelable: true});
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(requestZoom).not.toHaveBeenCalled();
  });

  it('preserves other keys and releases browser shortcuts when the viewer is closed or has no document', () => {
    function key(options: KeyboardEventInit) {
      const event = new KeyboardEvent('keydown', {...options, bubbles: true, cancelable: true});
      document.dispatchEvent(event);
      return event;
    }
    expect(key({key: '+', ctrlKey: true, altKey: true}).defaultPrevented).toBe(false);
    expect(key({key: '+'}).defaultPrevented).toBe(false);
    expect(key({key: '0', ctrlKey: true}).defaultPrevented).toBe(false);
    documentId = '';
    expect(key({key: '+', ctrlKey: true}).defaultPrevented).toBe(false);
    documentId = 'doc';
    host.remove();
    expect(key({key: '+', ctrlKey: true}).defaultPrevented).toBe(false);
    expect(requestZoom).not.toHaveBeenCalled();
  });

  it('keeps one keyboard listener after setup and removes it on abort', () => {
    setup();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: '+', ctrlKey: true, bubbles: true, cancelable: true}));
    expect(requestZoom).toHaveBeenCalledOnce();
    dispose();
    const event = new KeyboardEvent('keydown', {key: '-', ctrlKey: true, bubbles: true, cancelable: true});
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(requestZoom).toHaveBeenCalledOnce();
  });
});
