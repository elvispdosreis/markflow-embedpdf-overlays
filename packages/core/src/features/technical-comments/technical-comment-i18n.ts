import type {I18nCapability} from '@embedpdf/snippet';

export const TECHNICAL_COMMENT_I18N_KEYS = {
  tool: 'markflow.technicalComments.tool',
  title: 'markflow.technicalComments.title',
  legend: 'markflow.technicalComments.legend',
  error: 'markflow.technicalComments.error',
  note: 'markflow.technicalComments.note',
  question: 'markflow.technicalComments.question',
  resolved: 'markflow.technicalComments.resolved',
  newType: 'markflow.technicalComments.newType',
  type: 'markflow.technicalComments.type',
  place: 'markflow.technicalComments.place',
  stop: 'markflow.technicalComments.stop',
  hint: 'markflow.technicalComments.hint',
  previous: 'markflow.technicalComments.previous',
  next: 'markflow.technicalComments.next',
  goTo: 'markflow.technicalComments.goTo',
  page: 'markflow.technicalComments.page',
  text: 'markflow.technicalComments.text',
  placeholder: 'markflow.technicalComments.placeholder',
  delete: 'markflow.technicalComments.delete',
  empty: 'markflow.technicalComments.empty',
  emptyHint: 'markflow.technicalComments.emptyHint'
} as const;

type Translations = Record<keyof typeof TECHNICAL_COMMENT_I18N_KEYS, string>;

const TRANSLATIONS: Record<string, Translations> = {
  en: {
    tool: 'Technical comment', title: 'Technical comments', legend: 'Legend', error: 'Error', note: 'Annotation', question: 'Question', resolved: 'Resolved',
    newType: 'Next comment type', type: 'Type', place: 'Place on page', stop: 'Stop placing',
    hint: 'Choose a type and click a point on the drawing.', previous: 'Previous comment', next: 'Next comment',
    goTo: 'Go to comment', page: 'Page', text: 'Comment text', placeholder: 'Describe the comment…',
    delete: 'Delete comment', empty: 'No technical comments', emptyHint: 'Choose a type and mark a point on the drawing.'
  },
  'pt-BR': {
    tool: 'Comentário técnico', title: 'Comentários técnicos', legend: 'Legenda', error: 'Erro', note: 'Anotação', question: 'Dúvida', resolved: 'Resolvido',
    newType: 'Tipo do próximo comentário', type: 'Tipo', place: 'Marcar na página', stop: 'Parar marcação',
    hint: 'Escolha o tipo e clique no ponto da planta.', previous: 'Comentário anterior', next: 'Próximo comentário',
    goTo: 'Ir ao comentário', page: 'Página', text: 'Texto do comentário', placeholder: 'Descreva o comentário…',
    delete: 'Excluir comentário', empty: 'Nenhum comentário técnico',
    emptyHint: 'Escolha um tipo e marque um ponto na planta.'
  }
};

export function registerTechnicalCommentTranslations(i18n: I18nCapability): void {
  for (const [code, technicalComments] of Object.entries(TRANSLATIONS)) {
    const locale = i18n.getLocaleInfo(code);
    if (!locale) continue;
    const existing = locale.translations['markflow'];
    locale.translations['markflow'] = {
      ...(typeof existing === 'object' && existing ? existing : {}),
      technicalComments
    };
  }
}
