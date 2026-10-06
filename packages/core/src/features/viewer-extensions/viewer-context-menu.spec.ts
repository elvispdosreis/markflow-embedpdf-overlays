import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createEmitter} from '@embedpdf/core';
import {mountViewerContextMenu, type ViewerContextMenuOptions} from './viewer-context-menu';

describe('Viewer context menu', () => {
  let host: HTMLElement;
  let root: ShadowRoot;
  let viewport: HTMLElement;
  let documentId: string;
  let activeTool: string | null;
  let panMode: boolean;
  let mode: string;
  let disabled: Set<string>;
  let execute: ReturnType<typeof vi.fn<(commandId: keyof typeof toolNames, doc: string) => void>>;
  let dispose: () => void;
  let setup: () => void;
  let historyLimit: number | undefined;
  let blocked: boolean;
  let beforeModeChange: ReturnType<typeof vi.fn<() => void>>;
  const events = createEmitter<{documentId: string; tool: {id: string} | null}>();
  const toolNames = {'annotation:add-ink': 'ink', 'annotation:add-square': 'square',
    'measure:distance': 'distance', 'technical-comment:create': 'comment',
    'annotation:add-text': 'text', 'annotation:add-callout': 'callout'};

  beforeEach(() => {
    host = document.createElement('div'); document.body.append(host);
    root = host.attachShadow({mode: 'open'});
    viewport = document.createElement('div'); viewport.style.overflow = 'auto';
    Object.defineProperties(viewport, {clientWidth: {value: 800}, clientHeight: {value: 600}});
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({left: 10, top: 20, right: 810, bottom: 620,
      width: 800, height: 600, x: 10, y: 20, toJSON: () => ({})});
    root.append(viewport);
    const toolbar = document.createElement('div');
    toolbar.innerHTML = '<button data-epdf-i="ink-button"><svg viewBox="0 0 24 24"><path d="M1 1L2 2"/></svg></button>';
    root.append(toolbar);
    documentId = 'doc'; activeTool = null; panMode = true; mode = 'panMode'; disabled = new Set();
    execute = vi.fn((commandId: keyof typeof toolNames, doc: string) => {
      activeTool = toolNames[commandId]; events.emit({documentId: doc, tool: {id: activeTool}});
    });
    const resolve = (id: string) => ({id, label: id, visible: true, disabled: disabled.has(id),
      active: toolNames[id as keyof typeof toolNames] === activeTool,
      categories: id.startsWith('mode:') ? ['annotation', 'mode'] : ['annotation']});
    const capabilities = {
      commands: {execute, resolve, getAllCommands: () => Object.keys(toolNames).map(resolve)},
      pan: {forDocument: () => ({isPanMode: () => panMode, enablePan: () => {panMode = true; mode = 'panMode';}})},
      'interaction-manager': {forDocument: () => ({getActiveMode: () => mode, activate: (value: string) => {mode = value; panMode = false;}})},
      'document-manager': {getActiveDocumentId: () => documentId},
      ui: {getSchema: () => ({toolbars: {test: {items: [{id: 'ink-button', commandId: 'annotation:add-ink'}]}}, menus: {}})}
    };
    historyLimit = undefined; blocked = false; beforeModeChange = vi.fn();
    setup = () => {
      dispose?.();
      dispose = mountViewerContextMenu({
        root, getViewport: () => viewport, getActiveDocumentId: () => documentId,
        annotation: {onActiveToolChange: events.on, forDocument: () => ({
          getActiveTool: () => activeTool ? {id: activeTool} : null, setActiveTool: (value: string | null) => {activeTool = value;}
        })},
        commands: capabilities.commands, pan: capabilities.pan, interaction: capabilities['interaction-manager'], ui: capabilities.ui,
        historyLimit, isBlocked: () => blocked, beforeModeChange
      } as unknown as ViewerContextMenuOptions);
    };
    setup();
  });

  afterEach(() => {
    dispose(); events.clear(); host.remove(); vi.restoreAllMocks();
  });

  function open(target = viewport, x = 100, y = 100) {
    const event = new MouseEvent('contextmenu', {clientX: x, clientY: y, bubbles: true, composed: true, cancelable: true});
    target.dispatchEvent(event);
    return event;
  }
  function buttons() {return Array.from(root.querySelectorAll<HTMLButtonElement>('.pdf-markflow-context-menu button'));}

  it('opens only inside the plant with both fixed modes, preserves text context menus and ignores empty documents', () => {
    expect(open().defaultPrevented).toBe(true);
    expect(buttons().map(button => button.title)).toEqual(['Modo Arrastar', 'Modo Ponteiro']);
    const input = document.createElement('input'); viewport.append(input);
    expect(open(input).defaultPrevented).toBe(false);
    const outside = document.createElement('div'); root.append(outside);
    expect(open(outside).defaultPrevented).toBe(false);
    documentId = '';
    expect(open().defaultPrevented).toBe(false);
  });

  it('accepts a custom history size without counting fixed modes', () => {
    historyLimit = 2; setup();
    execute('annotation:add-ink', documentId);
    execute('annotation:add-square', documentId);
    execute('annotation:add-text', documentId);
    open();
    expect(buttons().map(button => button.title)).toEqual([
      'Modo Arrastar', 'Modo Ponteiro', 'annotation:add-text', 'annotation:add-square'
    ]);
  });

  it('delegates application restrictions and mode preparation to callbacks', () => {
    blocked = true;
    expect(open().defaultPrevented).toBe(false);
    expect(buttons()).toHaveLength(0);
    blocked = false;
    open(); buttons()[1].click();
    expect(beforeModeChange).toHaveBeenCalledOnce();
    expect(mode).toBe('pointerMode');
  });

  it('stores five distinct recent tools in use order, reuses native icons and excludes toolbar tabs', () => {
    execute('annotation:add-ink', documentId);
    execute('annotation:add-square', documentId);
    execute('measure:distance', documentId);
    execute('technical-comment:create', documentId);
    execute('annotation:add-text', documentId);
    execute('annotation:add-callout', documentId);
    execute('annotation:add-ink', documentId);
    events.emit({documentId, tool: null});
    open();
    expect(buttons().map(button => button.dataset['commandId'])).toEqual([
      'pan:toggle', 'pointer:toggle', 'annotation:add-ink', 'annotation:add-callout',
      'annotation:add-text', 'technical-comment:create', 'measure:distance'
    ]);
    expect(buttons()[2].querySelector('path')?.getAttribute('d')).toBe('M1 1L2 2');
  });

  it('activates fixed modes idempotently and clears annotation tools', () => {
    activeTool = 'ink'; open(); buttons()[0].click();
    expect(activeTool).toBeNull(); expect(panMode).toBe(true);
    open(); buttons()[0].click(); expect(panMode).toBe(true);
    open(); buttons()[1].click(); expect(mode).toBe('pointerMode');
    open(); buttons()[1].click(); expect(mode).toBe('pointerMode');
    expect(buttons()).toHaveLength(0);
  });

  it('reactivates recent tools through official commands and keeps an active tool selected', () => {
    execute('annotation:add-ink', documentId); activeTool = null; execute.mockClear();
    open(); buttons()[2].click();
    expect(execute).toHaveBeenCalledWith('annotation:add-ink', 'doc', 'ui'); expect(activeTool).toBe('ink');
    execute.mockClear(); open(); buttons()[2].click(); expect(execute).not.toHaveBeenCalled();
  });

  it('records native toolbar activation without relying on command execution events', () => {
    activeTool = 'ink'; events.emit({documentId, tool: {id: 'ink'}});
    open(); expect(buttons()[2].dataset['commandId']).toBe('annotation:add-ink');
    expect(execute).not.toHaveBeenCalled();
  });

  it('isolates history by document and omits disabled tools', () => {
    execute('annotation:add-ink', documentId); documentId = 'other'; open(); expect(buttons()).toHaveLength(2);
    documentId = 'doc'; disabled.add('annotation:add-ink'); open(); expect(buttons()).toHaveLength(2);
  });

  it('fits the menu near the bottom/right viewport edges', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(46);
    open(viewport, 810, 620);
    const menu = root.querySelector<HTMLElement>('.pdf-markflow-context-menu')!;
    expect(Number.parseFloat(menu.style.left) + 200).toBeLessThanOrEqual(806);
    expect(Number.parseFloat(menu.style.top) + 46).toBeLessThanOrEqual(616);
  });

  it('dismisses on outside clicks, scroll and Escape and supports keyboard navigation', () => {
    open(); buttons()[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
    expect(root.activeElement).toBe(buttons()[1]);
    const escape = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, composed: true, cancelable: true});
    buttons()[1].dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(buttons()).toHaveLength(0);
    open(); viewport.dispatchEvent(new Event('scroll')); expect(buttons()).toHaveLength(0);
    open(); document.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); expect(buttons()).toHaveLength(0);
  });

  it('prevents right mouse presses from reaching drawing handlers and cleans up on repeated setup/abort', () => {
    const draw = vi.fn(); viewport.addEventListener('pointerdown', draw);
    viewport.dispatchEvent(new PointerEvent('pointerdown', {button: 2, bubbles: true, composed: true}));
    expect(draw).not.toHaveBeenCalled();
    viewport.dispatchEvent(new PointerEvent('pointerdown', {button: 0, bubbles: true, composed: true}));
    expect(draw).toHaveBeenCalledOnce();
    setup(); open(); expect(root.querySelectorAll('.pdf-markflow-context-menu')).toHaveLength(1);
    dispose(); expect(buttons()).toHaveLength(0); expect(open().defaultPrevented).toBe(false);
  });
});
