import type {CommandsCapability} from '@embedpdf/plugin-commands';
import type {UICapability} from '@embedpdf/plugin-ui';
import type {I18nCapability} from '@embedpdf/plugin-i18n';
import type {CrosshairStyle} from '../crosshair/crosshair-context';
import {CROSSHAIR_I18N_KEYS, registerViewerToolTranslations} from '../guides/viewer-tools-i18n';
import {VIEWER_TOOL_ICON_NAMES} from '../guides/viewer-tools-icons';
import {firstAvailableShortcut, shortcutLabel, withViewerToolButtons} from './viewer-command-ui';

export interface ViewerCrosshairMenuOptions {
  commands: CommandsCapability;
  ui: UICapability;
  i18n?: I18nCapability;
  isEnabled(): boolean;
  getStyle(): CrosshairStyle;
  hasDocument(): boolean;
  isBlocked(): boolean;
  setEnabled(enabled: boolean, style?: CrosshairStyle): void;
}

/** Register once after the viewer capabilities are ready. */
export function registerViewerCrosshairMenu(options: ViewerCrosshairMenuOptions): void {
  const {commands, ui, i18n} = options;
  if (i18n) registerViewerToolTranslations(i18n);
  const menuId = 'crosshair-menu';
  const toggleShortcut = firstAvailableShortcut(commands, ['m', 'shift+m', 'alt+m']);
  commands.registerCommand({
    id: 'crosshair:toggle', label: 'Ativar/desativar mira', labelKey: CROSSHAIR_I18N_KEYS.toggle,
    icon: VIEWER_TOOL_ICON_NAMES.crosshairFull,
    shortcuts: toggleShortcut, shortcutLabel: shortcutLabel(toggleShortcut),
    active: () => options.isEnabled(),
    disabled: () => !options.hasDocument() || options.isBlocked(),
    action: ({documentId}) => {
      options.setEnabled(!options.isEnabled());
      ui.forDocument(documentId).closeMenu(menuId);
    }
  });
  commands.registerCommand({
    id: 'crosshair:menu', label: 'Mira', labelKey: CROSSHAIR_I18N_KEYS.menu,
    icon: VIEWER_TOOL_ICON_NAMES.crosshairFull,
    action: ({documentId}) => ui.toggleMenu(menuId, 'crosshair:menu', 'crosshair-menu-button', documentId)
  });
  commands.registerCommand({
    id: 'crosshair:full', label: 'Mira completa', labelKey: CROSSHAIR_I18N_KEYS.full,
    icon: VIEWER_TOOL_ICON_NAMES.crosshairFull,
    active: () => options.isEnabled() && options.getStyle() === 'full',
    action: ({documentId}) => {
      const active = options.isEnabled() && options.getStyle() === 'full';
      options.setEnabled(!active, 'full');
      ui.forDocument(documentId).closeMenu(menuId);
    }
  });
  commands.registerCommand({
    id: 'crosshair:simple', label: 'Mira simples', labelKey: CROSSHAIR_I18N_KEYS.small,
    icon: VIEWER_TOOL_ICON_NAMES.crosshairSmall,
    active: () => options.isEnabled() && options.getStyle() === 'small',
    action: ({documentId}) => {
      const active = options.isEnabled() && options.getStyle() === 'small';
      options.setEnabled(!active, 'small');
      ui.forDocument(documentId).closeMenu(menuId);
    }
  });
  const toolbar = ui.getSchema().toolbars['main-toolbar'];
  if (!toolbar) return;
  ui.mergeSchema({
    toolbars: {'main-toolbar': withViewerToolButtons(toolbar, false, true)},
    menus: {[menuId]: {id: menuId, items: [
      {type: 'command', id: 'crosshair-full', commandId: 'crosshair:full'},
      {type: 'command', id: 'crosshair-simple', commandId: 'crosshair:simple'}
    ]}}
  });
}
