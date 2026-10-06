import type {CommandsCapability} from '@embedpdf/plugin-commands';
import type {UICapability} from '@embedpdf/plugin-ui';
import type {I18nCapability} from '@embedpdf/plugin-i18n';
import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import {TECHNICAL_COMMENT_TOOL_ID} from '../technical-comments/technical-comment.models';
import {TECHNICAL_COMMENT_I18N_KEYS, registerTechnicalCommentTranslations} from '../technical-comments/technical-comment-i18n';
import {TECHNICAL_COMMENT_ICON_NAME} from '../technical-comments/technical-comment-icons';

export interface ViewerTechnicalCommentMenuOptions {
  commands: CommandsCapability;
  ui: UICapability;
  i18n?: I18nCapability;
  annotation?: AnnotationCapability;
  toggleTool(documentId: string): void;
}

export function registerViewerTechnicalCommentMenu(options: ViewerTechnicalCommentMenuOptions): void {
  const {commands, ui, i18n} = options;
  if (i18n) registerTechnicalCommentTranslations(i18n);
  commands.registerCommand({
    id: 'technical-comment:place',
    label: 'Comentário técnico',
    labelKey: TECHNICAL_COMMENT_I18N_KEYS.tool,
    icon: TECHNICAL_COMMENT_ICON_NAME,
    categories: ['annotation', 'technical-comment'],
    action: ({documentId}) => options.toggleTool(documentId),
    active: ({documentId}) => options.annotation?.forDocument(documentId).getActiveTool()?.id === TECHNICAL_COMMENT_TOOL_ID
  });

  const schema = ui.getSchema();
  const mainToolbar = schema.toolbars['main-toolbar'];
  if (!mainToolbar) return;
  ui.mergeSchema({
    toolbars: {
      'main-toolbar': {
        ...mainToolbar,
        items: mainToolbar.items.map(item => {
          if (item.type !== 'group' || item.id !== 'right-group') return item;
          const items = item.items.filter(child => child.id !== 'technical-comments-button');
          const index = items.findIndex(child => child.id === 'comment-button');
          items.splice(index >= 0 ? index + 1 : items.length, 0, {
            type: 'command-button', id: 'technical-comments-button', commandId: 'technical-comment:place',
            variant: 'icon', categories: ['annotation', 'technical-comment']
          });
          return {...item, items};
        })
      }
    },
    sidebars: {
      'markflow-technical-comments-sidebar': {
        id: 'markflow-technical-comments-sidebar',
        position: {placement: 'right', slot: 'main', order: 1},
        content: {type: 'component', componentId: 'markflow-technical-comments-sidebar'},
        width: '330px', minWidth: '290px', collapsible: true, defaultOpen: false,
        categories: ['annotation', 'technical-comment']
      }
    }
  });
}
