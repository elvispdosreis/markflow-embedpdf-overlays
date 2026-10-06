import type {I18nCapability} from '@embedpdf/snippet';

export const CROSSHAIR_I18N_KEYS = {
  toggle: 'markflow.crosshair.toggle',
  menu: 'markflow.crosshair.menu',
  active: 'markflow.crosshair.active',
  enable: 'markflow.crosshair.enable',
  disable: 'markflow.crosshair.disable',
  small: 'markflow.crosshair.small',
  full: 'markflow.crosshair.full'
} as const;

export const GUIDES_I18N_KEYS = {
  toggle: 'markflow.guides.toggle',
  menu: 'markflow.guides.menu',
  add: 'markflow.guides.add',
  enable: 'markflow.guides.enable',
  disable: 'markflow.guides.disable',
  horizontal: 'markflow.guides.horizontal',
  vertical: 'markflow.guides.vertical',
  visible: 'markflow.guides.visible',
  locked: 'markflow.guides.locked',
  clear: 'markflow.guides.clear'
} as const;

export const DOCUMENT_ACTION_I18N_KEYS = {
  importXfdf: 'markflow.documentActions.importXfdf',
  exportXfdf: 'markflow.documentActions.exportXfdf',
  downloadPdf: 'markflow.documentActions.downloadPdf',
  loadSavedAnnotations: 'markflow.documentActions.loadSavedAnnotations',
  saveSavedAnnotations: 'markflow.documentActions.saveSavedAnnotations'
} as const;

type CrosshairTranslations = Record<keyof typeof CROSSHAIR_I18N_KEYS, string>;
type GuidesTranslations = Record<keyof typeof GUIDES_I18N_KEYS, string>;
type DocumentActionTranslations = Record<keyof typeof DOCUMENT_ACTION_I18N_KEYS, string>;

const TRANSLATIONS: Record<string, {crosshair: CrosshairTranslations; guides: GuidesTranslations; documentActions: DocumentActionTranslations}> = {
  en: {
    crosshair: {
      toggle: 'Toggle crosshair',
      menu: 'Crosshair',
      active: 'Crosshair active',
      enable: 'Enable crosshair',
      disable: 'Disable crosshair',
      small: 'Simple crosshair',
      full: 'Full crosshair'
    },
    guides: {
      toggle: 'Toggle rulers and guides',
      menu: 'Guides',
      add: 'Add guide',
      enable: 'Enable rulers and guides',
      disable: 'Disable rulers and guides',
      horizontal: 'Add horizontal guide',
      vertical: 'Add vertical guide',
      visible: 'Show guides',
      locked: 'Lock guides',
      clear: 'Clear all document guides'
    },
    documentActions: {
      importXfdf: 'Import XFDF',
      exportXfdf: 'Export XFDF',
      downloadPdf: 'Download PDF',
      loadSavedAnnotations: 'Load Previous Annotations',
      saveSavedAnnotations: 'Save Annotations'
    }
  },
  'pt-BR': {
    crosshair: {
      toggle: 'Ativar/desativar mira',
      menu: 'Mira',
      active: 'Mira ativa',
      enable: 'Ativar mira',
      disable: 'Desativar mira',
      small: 'Mira simples',
      full: 'Mira completa'
    },
    guides: {
      toggle: 'Ativar/desativar Réguas e Guias',
      menu: 'Régua/Guias',
      add: 'Adicionar guia',
      enable: 'Ativar Réguas e Guias',
      disable: 'Desativar Réguas e Guias',
      horizontal: 'Adicionar Guia horizontal',
      vertical: 'Adicionar Guia vertical',
      visible: 'Mostrar guias',
      locked: 'Bloquear guias',
      clear: 'Limpar todas as Guias do documento'
    },
    documentActions: {
      importXfdf: 'Importar XFDF',
      exportXfdf: 'Exportar XFDF',
      downloadPdf: 'Baixar PDF',
      loadSavedAnnotations: 'Carregar Anotações Anterior',
      saveSavedAnnotations: 'Salvar Anotações'
    }
  }
};

/** Adds markflow-tool translations while preserving EmbedPDF's native locale dictionaries. */
export function registerViewerToolTranslations(i18n: I18nCapability): void {
  for (const [code, translations] of Object.entries(TRANSLATIONS)) {
    const locale = i18n.getLocaleInfo(code);
    if (!locale) continue;
    const existing = locale.translations['markflow'];
    locale.translations['markflow'] = {
      ...(typeof existing === 'object' && existing ? existing : {}),
      ...translations
    };
  }
}
