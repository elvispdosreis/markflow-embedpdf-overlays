import type {CommandsCapability} from '@embedpdf/plugin-commands';
import type {UICapability} from '@embedpdf/plugin-ui';
import type {I18nCapability} from '@embedpdf/plugin-i18n';
import {GUIDES_I18N_KEYS, registerViewerToolTranslations} from '../guides/viewer-tools-i18n';
import {VIEWER_TOOL_ICON_NAMES} from '../guides/viewer-tools-icons';
import {firstAvailableShortcut, shortcutLabel, withViewerToolButtons} from './viewer-command-ui';

export interface ViewerGuidesMenuOptions {
  commands: CommandsCapability;
  ui: UICapability;
  i18n?: I18nCapability;
  state: {
    enabled(): boolean;
    get(documentId: string): {guidesVisible: boolean; guidesLocked: boolean};
    setVisible(documentId: string, visible: boolean): void;
    setLocked(documentId: string, locked: boolean): void;
    clear(documentId: string): void;
  };
  hasDocument(): boolean;
  isBlocked(): boolean;
  includeCrosshair(): boolean;
  setEnabled(enabled: boolean): void;
  beginGuide(orientation: 'horizontal' | 'vertical'): void;
  cancelCreation(): void;
  onStatus(message: string): void;
}

/** State and application actions are supplied by the host, without Angular dependencies. */
export function registerViewerGuidesMenu(options: ViewerGuidesMenuOptions): void {
  const {commands, ui, i18n} = options;
  if (i18n) registerViewerToolTranslations(i18n);
  const menuId = 'guides-menu';
  const toggleShortcut = firstAvailableShortcut(commands, ['shift+r', 'alt+shift+r', 'shift+g']);
  commands.registerCommand({
    id: 'guides:toggle', label: 'Ativar/desativar réguas e Guides', labelKey: GUIDES_I18N_KEYS.toggle,
    icon: VIEWER_TOOL_ICON_NAMES.guides,
    shortcuts: toggleShortcut, shortcutLabel: shortcutLabel(toggleShortcut),
    active: () => options.state.enabled(),
    disabled: () => !options.hasDocument() || options.isBlocked(),
    action: ({documentId}) => {
      options.setEnabled(!options.state.enabled());
      ui.forDocument(documentId).closeMenu(menuId);
    }
  });
  commands.registerCommand({
    id: 'guides:menu', label: 'Régua/Guias', labelKey: GUIDES_I18N_KEYS.menu,
    icon: VIEWER_TOOL_ICON_NAMES.guides,
    active: () => options.state.enabled(),
    action: ({documentId}) => ui.toggleMenu(menuId, 'guides:menu', 'guides-menu-button', documentId)
  });
  for (const orientation of ['horizontal', 'vertical'] as const) commands.registerCommand({
    id: `guides:${orientation}`, label: `Adicionar ${orientation}`,
    labelKey: GUIDES_I18N_KEYS[orientation],
    icon: orientation === 'horizontal' ? VIEWER_TOOL_ICON_NAMES.guideHorizontal : VIEWER_TOOL_ICON_NAMES.guideVertical,
    action: ({documentId}) => {options.beginGuide(orientation); ui.forDocument(documentId).closeAllMenus();}
  });
  commands.registerCommand({
    id: 'guides:visible', label: 'Mostrar/ocultar Guides', labelKey: GUIDES_I18N_KEYS.visible,
    icon: VIEWER_TOOL_ICON_NAMES.guidesVisible,
    active: ({documentId}) => options.state.enabled() && options.state.get(documentId).guidesVisible,
    action: ({documentId}) => {
      options.cancelCreation();
      const visible = !(options.state.enabled() && options.state.get(documentId).guidesVisible);
      options.setEnabled(visible);
      options.state.setVisible(documentId, visible);
      options.onStatus(visible ? 'Guides visíveis.' : 'Guides ocultas; posições preservadas.');
      ui.forDocument(documentId).closeMenu(menuId);
    }
  });
  commands.registerCommand({
    id: 'guides:locked', label: 'Bloquear/desbloquear Guides', labelKey: GUIDES_I18N_KEYS.locked,
    icon: VIEWER_TOOL_ICON_NAMES.guidesLocked,
    active: ({documentId}) => options.state.get(documentId).guidesLocked,
    action: ({documentId}) => {
      options.cancelCreation();
      const locked = !options.state.get(documentId).guidesLocked;
      options.state.setLocked(documentId, locked);
      options.onStatus(locked ? 'Guides bloqueadas; cliques livres para medições.' : 'Guides desbloqueadas.');
      ui.forDocument(documentId).closeMenu(menuId);
    }
  });
  commands.registerCommand({
    id: 'guides:clear', label: 'Limpar todas as Guides do documento', labelKey: GUIDES_I18N_KEYS.clear,
    icon: VIEWER_TOOL_ICON_NAMES.guidesClear,
    action: ({documentId}) => {
      options.cancelCreation(); options.state.clear(documentId);
      options.onStatus('Todas as Guides deste documento foram removidas.');
      ui.forDocument(documentId).closeMenu(menuId);
    }
  });
  const toolbar = ui.getSchema().toolbars['main-toolbar'];
  if (!toolbar) return;
  ui.mergeSchema({
    toolbars: {'main-toolbar': withViewerToolButtons(toolbar, true, options.includeCrosshair())},
    menus: {
      [menuId]: {id: menuId, items: [
        {type: 'command', id: 'guides-visible', commandId: 'guides:visible'},
        {type: 'command', id: 'guides-locked', commandId: 'guides:locked'},
        {type: 'submenu', id: 'guides-add', labelKey: GUIDES_I18N_KEYS.add,
          icon: VIEWER_TOOL_ICON_NAMES.guideHorizontal, menuId: 'guides-add-menu'},
        {type: 'divider', id: 'guides-actions-divider'},
        {type: 'command', id: 'guides-clear', commandId: 'guides:clear'}
      ]},
      'guides-add-menu': {id: 'guides-add-menu', items: [
        {type: 'command', id: 'guides-horizontal', commandId: 'guides:horizontal'},
        {type: 'command', id: 'guides-vertical', commandId: 'guides:vertical'}
      ]}
    }
  });
}
