import {describe, expect, it, vi} from 'vitest';
import type {Command, CommandsCapability} from '@embedpdf/plugin-commands';
import type {UICapability, ToolbarSchema} from '@embedpdf/plugin-ui';
import {firstAvailableShortcut, withViewerToolButtons} from './viewer-command-ui';
import {registerViewerCrosshairMenu} from './viewer-crosshair-menu';
import {registerViewerGuidesMenu} from './viewer-guides-menu';
import {registerViewerTechnicalCommentMenu} from './viewer-technical-comment-menu';
import {registerViewerMeasurementMenu} from './viewer-measurement-menu';

function capabilities() {
  const registered = new Map<string, Command>();
  const closeMenu = vi.fn(), closeAllMenus = vi.fn();
  const mergeSchema = vi.fn();
  const commands = {
    getCommandByShortcut: (key: string) => key === 'm' ? {} : null,
    registerCommand: (command: Command) => registered.set(command.id, command)
  } as unknown as CommandsCapability;
  const ui = {
    getSchema: () => ({toolbars: {'main-toolbar': {id: 'main-toolbar', items: []}}, menus: {}}),
    mergeSchema, toggleMenu: vi.fn(), forDocument: () => ({closeMenu, closeAllMenus})
  } as unknown as UICapability;
  function action(id: string, documentId = 'doc') {registered.get(id)!.action({documentId} as never);}
  function flag(id: string, property: 'active' | 'disabled') {
    const value = registered.get(id)![property];
    return typeof value === 'function' ? value({documentId: 'doc'} as never) : value;
  }
  return {commands, ui, registered, closeMenu, closeAllMenus, mergeSchema, action, flag};
}

describe('Independent viewer command modules', () => {
  it('keeps occupied shortcuts and leaves a command unbound when all candidates are occupied', () => {
    const {commands} = capabilities();
    expect(firstAvailableShortcut(commands, ['m', 'shift+m'])).toBe('shift+m');
    expect(firstAvailableShortcut(commands, ['m'])).toBeUndefined();
  });

  it('inserts buttons beside a nested pointer without duplicates or mutating the native schema', () => {
    const original = {id: 'main-toolbar', items: [{type: 'group', id: 'left', items: [
      {type: 'command-button', id: 'pointer-button', commandId: 'pointer:toggle'},
      {type: 'command-button', id: 'crosshair-menu-button', commandId: 'crosshair:menu'}
    ]}]} as ToolbarSchema;
    const result = withViewerToolButtons(withViewerToolButtons(original, true, true), true, true);
    expect(result.items[0]).toMatchObject({items: [
      {id: 'pointer-button'}, {id: 'crosshair-menu-button'}, {id: 'guides-menu-button'}
    ]});
    expect((original.items[0] as {items: unknown[]}).items).toHaveLength(2);
  });

  it('reads current crosshair state and host restrictions when commands execute', () => {
    const c = capabilities();
    let enabled = false, blocked = false, hasDocument = true;
    let style: 'full' | 'small' = 'full';
    registerViewerCrosshairMenu({...c, isEnabled: () => enabled, getStyle: () => style,
      hasDocument: () => hasDocument, isBlocked: () => blocked,
      setEnabled: (value, selectedStyle = 'full') => {enabled = value; style = selectedStyle;}});
    expect(c.registered.get('crosshair:toggle')!.shortcuts).toBe('shift+m');
    c.action('crosshair:simple'); expect(enabled).toBe(true); expect(style).toBe('small');
    expect(c.flag('crosshair:simple', 'active')).toBe(true);
    c.action('crosshair:simple'); expect(enabled).toBe(false);
    blocked = true; expect(c.flag('crosshair:toggle', 'disabled')).toBe(true);
    blocked = false; hasDocument = false; expect(c.flag('crosshair:toggle', 'disabled')).toBe(true);
    expect(c.closeMenu).toHaveBeenCalledWith('crosshair-menu');
  });

  it('delegates guide document state and application actions through its contract', () => {
    const c = capabilities();
    let enabled = false;
    const state = {enabled: () => enabled, get: () => ({guidesVisible: true, guidesLocked: false}),
      setVisible: vi.fn(), setLocked: vi.fn(), clear: vi.fn()};
    const cancelCreation = vi.fn(), beginGuide = vi.fn(), onStatus = vi.fn();
    registerViewerGuidesMenu({...c, state, hasDocument: () => true, isBlocked: () => false,
      includeCrosshair: () => false, setEnabled: value => {enabled = value;}, cancelCreation, beginGuide, onStatus});
    c.action('guides:horizontal', 'other'); expect(beginGuide).toHaveBeenCalledWith('horizontal');
    c.action('guides:visible', 'other'); expect(state.setVisible).toHaveBeenCalledWith('other', true);
    c.action('guides:locked', 'other'); expect(state.setLocked).toHaveBeenCalledWith('other', true);
    c.action('guides:clear', 'other'); expect(state.clear).toHaveBeenCalledWith('other');
    expect(cancelCreation).toHaveBeenCalledTimes(3);
  });

  it('routes the technical comment command to the requested document', () => {
    const c = capabilities(), toggleTool = vi.fn();
    registerViewerTechnicalCommentMenu({...c, toggleTool});
    c.action('technical-comment:place', 'other');
    expect(toggleTool).toHaveBeenCalledWith('other');
    expect(c.mergeSchema.mock.calls[0][0].sidebars['markflow-technical-comments-sidebar']).toMatchObject({
      content: {componentId: 'markflow-technical-comments-sidebar'}
    });
  });

  it('filters toolbar changes and releases its subscription even without a main toolbar', () => {
    const c = capabilities(), unsubscribe = vi.fn(), onToolbarChange = vi.fn();
    let listener: (event: {documentId: string; placement: string; slot: string; toolbarId?: string}) => void;
    const ui = {...c.ui, getSchema: () => ({toolbars: {}, menus: {}}),
      onToolbarChanged: (callback: typeof listener) => {listener = callback; return unsubscribe;}} as unknown as UICapability;
    const dispose = registerViewerMeasurementMenu({...c, ui, toolCommands: [], showFormAndRedaction: false,
      onStatus: vi.fn(), hasStyleTarget: () => false, onToolbarChange, openCalibration: vi.fn(),
      canUndo: () => false, canRedo: () => true, undo: vi.fn(), redo: vi.fn()});
    listener!({documentId: 'doc', placement: 'bottom', slot: 'secondary'});
    expect(onToolbarChange).not.toHaveBeenCalled();
    listener!({documentId: 'other', placement: 'top', slot: 'secondary', toolbarId: 'measure-toolbar'});
    expect(onToolbarChange).toHaveBeenCalledWith('other', 'measure-toolbar');
    expect(c.flag('measure:undo', 'disabled')).toBe(true);
    expect(c.flag('measure:redo', 'disabled')).toBe(false);
    dispose(); expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
