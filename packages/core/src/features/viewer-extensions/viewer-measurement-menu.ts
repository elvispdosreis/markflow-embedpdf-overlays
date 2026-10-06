import type {Command, CommandsCapability} from '@embedpdf/plugin-commands';
import type {UICapability, TabGroupItem} from '@embedpdf/plugin-ui';
import type {I18nCapability} from '@embedpdf/plugin-i18n';
import {MEASUREMENT_I18N_KEYS, registerMeasurementTranslations} from '../measurement/measurement-i18n';
import {MEASUREMENT_ICON_NAMES} from '../measurement/measurement-icons';

export interface ViewerMeasurementMenuOptions {
  commands: CommandsCapability;
  ui: UICapability;
  i18n?: I18nCapability;
  toolCommands: readonly Command[];
  showFormAndRedaction: boolean;
  onStatus(message: string): void;
  hasStyleTarget(documentId: string): boolean;
  onToolbarChange(documentId: string, toolbarId: string | undefined): void;
  openCalibration(): void;
  canUndo(documentId: string): boolean;
  canRedo(documentId: string): boolean;
  undo(documentId: string): void;
  redo(documentId: string): void;
}

/** Dispose the toolbar subscription before remounting and when the viewer closes. */
export function registerViewerMeasurementMenu(options: ViewerMeasurementMenuOptions): () => void {
  const {commands, ui, i18n} = options;
  if (i18n) registerMeasurementTranslations(i18n);
  const unsubscribe = ui.onToolbarChanged?.(({documentId, placement, slot, toolbarId}) => {
    if (placement === 'top' && slot === 'secondary') options.onToolbarChange(documentId, toolbarId);
  });
  const dispose = () => unsubscribe?.();

  commands.registerCommand({
    id: 'mode:measure',
    label: 'Medições',
    labelKey: MEASUREMENT_I18N_KEYS.mode,
    categories: ['mode', 'mode-measure', 'annotation', 'measure'],
    action: ({documentId}) => {
      ui.setActiveToolbar('top', 'secondary', 'measure-toolbar', documentId);
      options.onStatus('Ferramentas de medição abertas.');
    },
    active: ({documentId}) => ui.forDocument(documentId).isToolbarOpen('top', 'secondary', 'measure-toolbar')
  });

  commands.registerCommand({
    id: 'panel:toggle-measurements',
    label: 'Medições',
    labelKey: MEASUREMENT_I18N_KEYS.mode,
    icon: MEASUREMENT_ICON_NAMES.sidebar,
    categories: ['panel', 'panel-measurements', 'measure'],
    action: ({documentId}) => ui.forDocument(documentId)
      .toggleSidebar('right', 'main', 'markflow-measurements-sidebar'),
    active: ({documentId}) => ui.forDocument(documentId)
      .isSidebarOpen('right', 'main', 'markflow-measurements-sidebar')
  });

  commands.registerCommand({
    id: 'panel:toggle-measurement-style',
    label: 'Estilos',
    labelKey: 'panel.annotationStyle',
    icon: 'palette',
    categories: ['panel', 'panel-annotation-style', 'measure'],
    action: ({documentId}) => {
      const sidebarId = options.hasStyleTarget(documentId)
        ? 'markflow-measurement-style-panel'
        : 'annotation-panel';
      ui.forDocument(documentId).toggleSidebar('left', 'main', sidebarId);
    },
    active: ({documentId}) => {
      const scope = ui.forDocument(documentId);
      return scope.isSidebarOpen('left', 'main', 'markflow-measurement-style-panel')
        || scope.isSidebarOpen('left', 'main', 'annotation-panel');
    }
  });

  for (const command of options.toolCommands) commands.registerCommand(command);

  commands.registerCommand({
    id: 'measure:calibrate',
    label: 'Calibrar',
    labelKey: MEASUREMENT_I18N_KEYS.calibrate,
    icon: MEASUREMENT_ICON_NAMES.calibration,
    categories: ['measure', 'measure-calibration'],
    action: () => options.openCalibration()
  });

  commands.registerCommand({
    id: 'measure:undo',
    label: 'Desfazer medição',
    icon: MEASUREMENT_ICON_NAMES.undo,
    categories: ['history', 'history-undo', 'measure'],
    disabled: ({documentId}) => !options.canUndo(documentId),
    action: ({documentId}) => options.undo(documentId)
  });
  commands.registerCommand({
    id: 'measure:redo',
    label: 'Refazer medição',
    icon: MEASUREMENT_ICON_NAMES.redo,
    categories: ['history', 'history-redo', 'measure'],
    disabled: ({documentId}) => !options.canRedo(documentId),
    action: ({documentId}) => options.redo(documentId)
  });

  const schema = ui.getSchema();
  const mainToolbar = schema.toolbars['main-toolbar'];
  const overflowMenu = schema.menus['mode-tabs-overflow-menu'];
  const annotationSelectionMenu = schema.selectionMenus?.['annotation'];
  if (!mainToolbar) {
    return dispose;
  }

  const mainItems = mainToolbar.items.map(item => {
    if (item.type === 'group' && item.id === 'right-group') {
      const items = item.items.filter(child => child.id !== 'measurements-sidebar-button');
      const commentIndex = items.findIndex(child => child.id === 'comment-button');
      items.splice(commentIndex >= 0 ? commentIndex + 1 : items.length, 0, {
        type: 'command-button',
        id: 'measurements-sidebar-button',
        commandId: 'panel:toggle-measurements',
        variant: 'icon',
        categories: ['panel', 'panel-measurements', 'measure']
      });
      return {...item, items};
    }
    if (item.type !== 'tab-group' || item.id !== 'mode-tabs') {
      return item;
    }

    const tabs = item.tabs.filter(tab => tab.id !== 'measure-mode'
      && (options.showFormAndRedaction || (tab.commandId !== 'mode:form' && tab.commandId !== 'mode:redact')));
    const overflowIndex = tabs.findIndex(tab => tab.id === 'overflow-tabs-button');
    const measureTab = {
      id: 'measure-mode',
      commandId: 'mode:measure',
      variant: 'text' as const,
      categories: ['mode', 'mode-measure', 'annotation', 'measure']
    };
    tabs.splice(overflowIndex >= 0 ? overflowIndex : tabs.length, 0, measureTab);
    return {...item, tabs} satisfies TabGroupItem;
  });

  const overflowItems = overflowMenu
    ? [
        ...overflowMenu.items.filter(item => item.id !== 'mode:measure'
          && (options.showFormAndRedaction || (item.id !== 'mode:form' && item.id !== 'mode:redact'))),
        {
          type: 'command' as const,
          id: 'mode:measure',
          commandId: 'mode:measure',
          categories: ['mode', 'mode-measure', 'annotation', 'measure']
        }
      ]
    : [];

  ui.mergeSchema({
    toolbars: {
      'main-toolbar': {...mainToolbar, items: mainItems},
      'measure-toolbar': {
        id: 'measure-toolbar',
        position: {placement: 'top', slot: 'secondary', order: 0},
        permanent: false,
        categories: ['annotation', 'measure'],
        items: [
          {type: 'spacer', id: 'measure-spacer-start', flex: true},
          {
            type: 'group',
            id: 'measure-tools',
            alignment: 'center',
            gap: 2,
            items: [
              ...options.toolCommands.map(definition => ({
                type: 'command-button' as const,
                id: definition.id,
                commandId: definition.id,
                variant: 'icon' as const,
                categories: ['annotation', 'measure']
              })),
              {type: 'divider', id: 'measure-divider-calibration', orientation: 'vertical'},
              {
                type: 'command-button',
                id: 'measure:calibrate',
                commandId: 'measure:calibrate',
                variant: 'icon',
                categories: ['measure', 'measure-calibration']
              },
              {type: 'divider', id: 'measure-divider-style', orientation: 'vertical'},
              {
                type: 'command-button',
                id: 'measure-annotation-style',
                commandId: 'panel:toggle-measurement-style',
                variant: 'icon',
                categories: ['panel', 'panel-annotation-style']
              },
              {
                type: 'command-button',
                id: 'measure-undo',
                commandId: 'measure:undo',
                variant: 'icon',
                categories: ['history', 'history-undo']
              },
              {
                type: 'command-button',
                id: 'measure-redo',
                commandId: 'measure:redo',
                variant: 'icon',
                categories: ['history', 'history-redo']
              }
            ]
          },
          {type: 'spacer', id: 'measure-spacer-end', flex: true}
        ]
      }
    },
    menus: overflowMenu
      ? {'mode-tabs-overflow-menu': {...overflowMenu, items: overflowItems}}
      : {},
    selectionMenus: annotationSelectionMenu ? {
      annotation: {
        ...annotationSelectionMenu,
        items: annotationSelectionMenu.items.map(item => item.id === 'toggle-annotation-style'
          ? {...item, commandId: 'panel:toggle-measurement-style'}
          : item)
      }
    } : {},
    sidebars: {
      'markflow-measurement-style-panel': {
        id: 'markflow-measurement-style-panel',
        position: {placement: 'left', slot: 'main', order: 0},
        content: {type: 'component', componentId: 'markflow-measurement-style-sidebar'},
        width: '315px',
        minWidth: '280px',
        collapsible: true,
        defaultOpen: false,
        categories: ['measure', 'panel-annotation-style']
      },
      'markflow-measurements-sidebar': {
        id: 'markflow-measurements-sidebar',
        position: {placement: 'right', slot: 'main', order: 0},
        content: {type: 'component', componentId: 'markflow-measurements-sidebar'},
        width: '320px',
        minWidth: '280px',
        collapsible: true,
        defaultOpen: false,
        categories: ['measure', 'panel-measurements']
      }
    }
  });
  return dispose;
}
