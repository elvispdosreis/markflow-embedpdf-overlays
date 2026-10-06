import {adjacentTechnicalComment, navigateToTechnicalComment} from './technical-comment-sidebar-controller';
export {adjacentTechnicalComment, navigateToTechnicalComment} from './technical-comment-sidebar-controller';
import type {BaseComponentProps} from '@embedpdf/plugin-ui/preact';
import {h} from 'preact';
import {
  getTechnicalCommentSidebarBridge,
  subscribeTechnicalCommentSidebar,
  type TechnicalCommentSidebarBridge
} from './technical-comment-sidebar-bridge';
import {TECHNICAL_COMMENT_TYPES, type TechnicalComment, type TechnicalCommentKind} from './technical-comment.models';
import {TECHNICAL_COMMENT_I18N_KEYS as I18N} from './technical-comment-i18n';
import {createTechnicalCommentPin} from './technical-comment-pin';


const ELEMENT_NAME = 'markflow-technical-comments-sidebar-view';
const KINDS: TechnicalCommentKind[] = ['error', 'note', 'question', 'resolved'];
const STYLES = `
  markflow-technical-comments-sidebar-view{display:block;height:100%;min-height:0;color:#172033}
  markflow-technical-comments-sidebar-view *{box-sizing:border-box}
  markflow-technical-comments-sidebar-view .tc-root{display:flex;height:100%;min-height:0;flex-direction:column;background:#fff}
  markflow-technical-comments-sidebar-view .tc-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;row-gap:5px;min-height:72px;padding:10px 16px;border-bottom:1px solid #e5e9f0}
  markflow-technical-comments-sidebar-view .tc-title{display:flex;align-items:center;gap:8px}
  markflow-technical-comments-sidebar-view .tc-title h2{margin:0;font-size:14px;font-weight:600}
  markflow-technical-comments-sidebar-view .tc-count{display:grid;min-width:22px;height:20px;place-items:center;border-radius:10px;padding:0 7px;background:#eef2f7;color:#526075;font-size:11px;font-weight:600}
  markflow-technical-comments-sidebar-view .tc-nav{display:flex;gap:6px}
  markflow-technical-comments-sidebar-view .tc-legend{display:flex;grid-column:1/-1;align-items:center;gap:5px;color:#42516a;font-size:11px;white-space:nowrap;cursor:pointer}
  markflow-technical-comments-sidebar-view .tc-legend input{accent-color:#2563eb;cursor:pointer}
  markflow-technical-comments-sidebar-view button{cursor:pointer}
  markflow-technical-comments-sidebar-view .tc-nav button{display:grid;width:30px;height:30px;place-items:center;border:1px solid #dce2ea;border-radius:7px;background:#fff;color:#42516a}
  markflow-technical-comments-sidebar-view .tc-nav button:hover:not(:disabled){background:#f3f6fa}
  markflow-technical-comments-sidebar-view button:disabled{opacity:.35;cursor:default}
  markflow-technical-comments-sidebar-view .tc-create{padding:12px 14px;border-bottom:1px solid #e5e9f0;background:#fbfcfe}
  markflow-technical-comments-sidebar-view .tc-create label{display:block;margin-bottom:6px;color:#64748b;font-size:11px;font-weight:600}
  markflow-technical-comments-sidebar-view .tc-create-row{display:flex;gap:8px}
  markflow-technical-comments-sidebar-view select,markflow-technical-comments-sidebar-view textarea{font:inherit;outline:none}
  markflow-technical-comments-sidebar-view .tc-create select{min-width:0;flex:1;height:34px;padding:0 9px;border:1px solid #d8dee8;border-radius:7px;background:#fff;color:#172033;font-size:12px}
  markflow-technical-comments-sidebar-view .tc-create button{height:34px;padding:0 10px;border:1px solid #2563eb;border-radius:7px;background:#2563eb;color:#fff;font-size:12px;font-weight:600;white-space:nowrap}
  markflow-technical-comments-sidebar-view .tc-create button.tc-creating{border-color:#b9c5d7;background:#eef2f7;color:#334155}
  markflow-technical-comments-sidebar-view .tc-hint{margin:7px 0 0;color:#64748b;font-size:11px;line-height:1.4}
  markflow-technical-comments-sidebar-view .tc-list{min-height:0;flex:1;overflow-y:auto;margin:0;padding:10px;list-style:none}
  markflow-technical-comments-sidebar-view .tc-list>li+li{margin-top:8px}
  markflow-technical-comments-sidebar-view .tc-card{padding:10px;border:1px solid #e0e5ec;border-radius:9px;background:#fff;transition:border-color .15s,box-shadow .15s}
  markflow-technical-comments-sidebar-view .tc-card:hover{border-color:#c6cfdb}
  markflow-technical-comments-sidebar-view .tc-card.tc-selected{border-color:#6b8fdc;box-shadow:0 0 0 1px rgba(74,112,194,.08)}
  markflow-technical-comments-sidebar-view .tc-card-top{display:flex;align-items:center;gap:8px}
  markflow-technical-comments-sidebar-view .tc-number{display:grid;width:26px;height:26px;flex:none;place-items:center;padding:0;border:0;background:transparent}
  markflow-technical-comments-sidebar-view .tc-number .markflow-comment-pin{display:block;width:26px;height:26px;filter:drop-shadow(0 1px 2px #0003)}
  markflow-technical-comments-sidebar-view .tc-kind{min-width:0;flex:1;height:32px;padding:0 8px;border:1px solid #edf0f4;border-radius:6px;background:#f7f9fc;color:var(--comment-color);font-size:12px;font-weight:600}
  markflow-technical-comments-sidebar-view .tc-delete{display:grid;width:28px;height:28px;flex:none;place-items:center;border:0;border-radius:6px;background:transparent;color:#dc2626;font-size:21px;line-height:1}
  markflow-technical-comments-sidebar-view .tc-delete:hover{background:#fef2f2}
  markflow-technical-comments-sidebar-view .tc-page{margin:7px 0 6px;color:#8290a3;font-size:10px}
  markflow-technical-comments-sidebar-view .tc-body{width:100%;min-height:72px;resize:vertical;padding:9px 10px;border:1px solid #edf0f4;border-radius:7px;background:#f7f9fc;color:#172033;font-size:12px;line-height:1.45}
  markflow-technical-comments-sidebar-view .tc-body:focus,markflow-technical-comments-sidebar-view select:focus-visible,markflow-technical-comments-sidebar-view button:focus-visible{border-color:#5b7fc8;box-shadow:0 0 0 2px rgba(91,127,200,.12)}
  markflow-technical-comments-sidebar-view .tc-empty{display:flex;min-height:0;flex:1;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center}
  markflow-technical-comments-sidebar-view .tc-empty strong{font-size:13px}
  markflow-technical-comments-sidebar-view .tc-empty span{margin-top:4px;color:#66758a;font-size:11px;line-height:1.5}
`;

export function TechnicalCommentSidebar({documentId}: BaseComponentProps) {
  defineTechnicalCommentSidebarElement();
  return h(ELEMENT_NAME, {documentId});
}

function defineTechnicalCommentSidebarElement(): void {
  if (typeof customElements === 'undefined' || customElements.get(ELEMENT_NAME)) return;

  class TechnicalCommentSidebarElement extends HTMLElement {
    private currentDocumentId = '';
    private unsubscribe?: () => void;

    set documentId(value: string) { this.currentDocumentId = value; this.renderSidebar(); }
    get documentId(): string { return this.currentDocumentId; }

    connectedCallback(): void {
      this.unsubscribe = subscribeTechnicalCommentSidebar(() => this.renderSidebar());
      this.renderSidebar();
    }

    disconnectedCallback(): void { this.unsubscribe?.(); this.unsubscribe = undefined; }

    private t(bridge: TechnicalCommentSidebarBridge, key: string, fallback: string): string {
      return bridge.translate(this.currentDocumentId, key, fallback);
    }

    private renderSidebar(): void {
      const bridge = getTechnicalCommentSidebarBridge();
      if (!bridge || !this.currentDocumentId) return;
      const scrollTop = this.querySelector<HTMLElement>('.tc-list')?.scrollTop ?? 0;
      const root = this.getRootNode();
      const focused = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
      const focusKey = focused instanceof HTMLElement && this.contains(focused) ? focused.dataset['focusKey'] : undefined;
      const textareaDraft = focused instanceof HTMLTextAreaElement ? {
        value: focused.value, start: focused.selectionStart, end: focused.selectionEnd
      } : null;
      const snapshot = bridge.snapshot(this.currentDocumentId);
      const container = node('section', 'tc-root');
      container.append(this.header(bridge, snapshot.items, snapshot.selectedId, snapshot.legendVisible));
      container.append(this.createControls(bridge, snapshot.creationKind, snapshot.creating));
      container.append(snapshot.items.length
        ? this.list(bridge, snapshot.items, snapshot.selectedId)
        : this.emptyState(bridge));
      const style = document.createElement('style'); style.textContent = STYLES;
      this.replaceChildren(style, container);
      const list = this.querySelector<HTMLElement>('.tc-list');
      if (list) list.scrollTop = scrollTop;
      if (focusKey) {
        const replacement = this.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`);
        if (textareaDraft && replacement instanceof HTMLTextAreaElement) {
          replacement.value = textareaDraft.value;
          replacement.setSelectionRange(textareaDraft.start, textareaDraft.end);
        }
        replacement?.focus({preventScroll: true});
      }
    }

    private header(bridge: TechnicalCommentSidebarBridge, items: TechnicalComment[], selectedId: string | null, legendVisible: boolean): HTMLElement {
      const header = node('header', 'tc-header');
      const title = node('div', 'tc-title');
      title.append(node('h2', '', this.t(bridge, I18N.title, 'Comentários técnicos')),
        node('span', 'tc-count', String(items.length)));
      const navigation = node('div', 'tc-nav');
      const legend = node('label', 'tc-legend');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.checked = legendVisible; checkbox.dataset['focusKey'] = 'legend';
      checkbox.addEventListener('change', () => bridge.setLegendVisible(this.currentDocumentId, checkbox.checked));
      legend.append(checkbox, document.createTextNode(this.t(bridge, I18N.legend, 'Legenda')));
      const index = items.findIndex(item => item.id === selectedId);
      navigation.append(
        this.navigationButton(bridge, '←', I18N.previous, 'Comentário anterior', index <= 0,
          () => this.navigate(bridge, adjacentTechnicalComment(items, selectedId, -1))),
        this.navigationButton(bridge, '→', I18N.next, 'Próximo comentário', index === items.length - 1 || items.length === 0,
          () => this.navigate(bridge, adjacentTechnicalComment(items, selectedId, 1)))
      );
      header.append(title, navigation, legend);
      return header;
    }

    private navigationButton(bridge: TechnicalCommentSidebarBridge, label: string, key: string, fallback: string, disabled: boolean, action: () => void): HTMLButtonElement {
      const button = node('button', '', label) as HTMLButtonElement;
      button.type = 'button'; button.disabled = disabled;
      button.title = this.t(bridge, key, fallback); button.ariaLabel = button.title;
      button.addEventListener('click', action);
      return button;
    }

    private createControls(bridge: TechnicalCommentSidebarBridge, kind: TechnicalCommentKind, creating: boolean): HTMLElement {
      const wrapper = node('div', 'tc-create');
      const label = node('label', '', this.t(bridge, I18N.newType, 'Tipo do próximo comentário'));
      const row = node('div', 'tc-create-row');
      const select = document.createElement('select'); select.dataset['focusKey'] = 'creation-kind';
      select.ariaLabel = label.textContent ?? '';
      for (const optionKind of KINDS) select.append(this.kindOption(bridge, optionKind, kind));
      select.addEventListener('change', () => bridge.setCreationKind(this.currentDocumentId, select.value as TechnicalCommentKind));
      const button = node('button', creating ? 'tc-creating' : '',
        creating ? this.t(bridge, I18N.stop, 'Parar marcação') : this.t(bridge, I18N.place, 'Marcar na página')) as HTMLButtonElement;
      button.type = 'button'; button.dataset['focusKey'] = 'create';
      button.addEventListener('click', () => bridge.startCreating(this.currentDocumentId));
      row.append(select, button);
      wrapper.append(label, row,
        node('p', 'tc-hint', this.t(bridge, I18N.hint, 'Escolha o tipo e clique no ponto da planta.')));
      return wrapper;
    }

    private kindOption(bridge: TechnicalCommentSidebarBridge, kind: TechnicalCommentKind, selected: TechnicalCommentKind): HTMLOptionElement {
      const option = document.createElement('option');
      option.value = kind; option.selected = kind === selected;
      option.textContent = this.t(bridge, I18N[kind], TECHNICAL_COMMENT_TYPES[kind].label);
      return option;
    }

    private list(bridge: TechnicalCommentSidebarBridge, items: TechnicalComment[], selectedId: string | null): HTMLElement {
      const list = node('ol', 'tc-list');
      for (const item of items) {
        const card = node('article', `tc-card${item.id === selectedId ? ' tc-selected' : ''}`);
        card.dataset['commentId'] = item.id;
        card.style.setProperty('--comment-color', item.color);
        card.addEventListener('click', event => {
          if ((event.target as Element).closest('button, select, textarea')) return;
          this.navigate(bridge, item);
        });
        const top = node('div', 'tc-card-top');
        const badge = node('button', 'tc-number') as HTMLButtonElement;
        badge.type = 'button'; badge.ariaLabel = `${this.t(bridge, I18N.goTo, 'Ir ao comentário')} ${item.number}`;
        badge.append(createTechnicalCommentPin(item.number, item.color));
        badge.addEventListener('click', () => this.navigate(bridge, item));
        const select = document.createElement('select'); select.className = 'tc-kind';
        select.dataset['commentKind'] = ''; select.dataset['focusKey'] = `kind-${item.id}`;
        select.ariaLabel = `${this.t(bridge, I18N.type, 'Tipo')} ${item.number}`;
        for (const kind of KINDS) select.append(this.kindOption(bridge, kind, item.kind));
        select.addEventListener('change', () => bridge.update(this.currentDocumentId, item.id, {kind: select.value as TechnicalCommentKind}));
        const remove = node('button', 'tc-delete', '×') as HTMLButtonElement;
        remove.type = 'button'; remove.dataset['commentAction'] = 'delete';
        remove.title = this.t(bridge, I18N.delete, 'Excluir comentário'); remove.ariaLabel = `${remove.title} ${item.number}`;
        remove.addEventListener('click', () => bridge.remove(this.currentDocumentId, item.id));
        top.append(badge, select, remove);
        const page = node('div', 'tc-page', `${this.t(bridge, I18N.page, 'Página')} ${item.pageIndex + 1}`);
        const body = document.createElement('textarea');
        body.className = 'tc-body'; body.value = item.body; body.rows = 3;
        body.dataset['focusKey'] = `body-${item.id}`;
        body.ariaLabel = `${this.t(bridge, I18N.text, 'Texto do comentário')} ${item.number}`;
        body.placeholder = this.t(bridge, I18N.placeholder, 'Descreva o comentário…');
        body.addEventListener('change', () => bridge.update(this.currentDocumentId, item.id, {body: body.value}));
        card.append(top, page, body);
        const entry = document.createElement('li'); entry.append(card); list.append(entry);
      }
      return list;
    }

    private emptyState(bridge: TechnicalCommentSidebarBridge): HTMLElement {
      const empty = node('div', 'tc-empty');
      empty.append(node('strong', '', this.t(bridge, I18N.empty, 'Nenhum comentário técnico')),
        node('span', '', this.t(bridge, I18N.emptyHint, 'Escolha um tipo e marque um ponto na planta.')));
      return empty;
    }

    private navigate(bridge: TechnicalCommentSidebarBridge, item: TechnicalComment | null): void {
      if (!item) return;
      bridge.navigate(this.currentDocumentId, item);
      this.renderSidebar();
    }
  }

  customElements.define(ELEMENT_NAME, TechnicalCommentSidebarElement);
}

function node(tag: string, className: string, text?: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
