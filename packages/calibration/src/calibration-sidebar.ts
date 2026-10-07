import {h} from 'preact';
import type {BaseComponentProps} from '@embedpdf/plugin-ui/preact';
import type {UICapability} from '@embedpdf/plugin-ui';
import {SCALE_PRESETS, PRECISION_OPTIONS, CALIBRATION_UNIT_OPTIONS, precisionLabel,
  type CalibrationDraft} from '@elvisreis/markflow-core/calibration';

export const CALIBRATION_SIDEBAR_ID = 'markflow-calibration-panel';
export const CALIBRATION_COMPONENT_ID = 'markflow-calibration-sidebar';
const ELEMENT = 'markflow-calibration-view';
export interface CalibrationSidebarBridge {
  snapshot(documentId: string): {draft: CalibrationDraft; valid: boolean};
  update(documentId: string, patch: Partial<CalibrationDraft>): void;
  apply(documentId: string): void;
  cancel(documentId: string): void;
}
let bridge: CalibrationSidebarBridge | null = null;
const listeners = new Set<() => void>();
export function registerCalibrationSidebarBridge(value: CalibrationSidebarBridge): () => void {
  bridge = value;
  notifyCalibrationSidebar();
  return () => {if (bridge === value) {bridge = null; notifyCalibrationSidebar();}};
}
export function notifyCalibrationSidebar(): void {for (const listener of listeners) listener();}

export function registerCalibrationSidebar(ui: UICapability): void {
  ui.mergeSchema({sidebars: {[CALIBRATION_SIDEBAR_ID]: {
    id: CALIBRATION_SIDEBAR_ID, position: {placement: 'left', slot: 'main', order: 0},
    content: {type: 'component', componentId: CALIBRATION_COMPONENT_ID},
    width: '280px', minWidth: '250px', collapsible: true, defaultOpen: false,
    categories: ['measure', 'panel-calibration']
  }}});
}

const CSS = `
${ELEMENT}{display:block;height:100%;min-height:0;color:var(--ep-color-fg-primary,#111827);font-size:14px}
${ELEMENT} *{box-sizing:border-box}
${ELEMENT} main{height:100%;overflow-y:auto;padding:18px 16px;background:var(--ep-color-bg-surface,#fff)}
${ELEMENT} h2{font-size:16px;font-weight:400;margin:0 0 20px}
${ELEMENT} section{margin:0 0 22px}
${ELEMENT} label{display:block;margin:0 0 8px;font-weight:400}
${ELEMENT} select,${ELEMENT} input{width:100%;height:30px;padding:0 8px;border:1px solid var(--ep-color-border-default,#cbd5e1);border-radius:3px;background:var(--ep-color-bg-input,#fff);color:inherit;font:inherit}
${ELEMENT} label :is(input,select){display:block;margin-top:8px}
${ELEMENT} button{font:inherit;height:36px;padding:0 10px;border:1px solid var(--ep-color-border-default,#cbd5e1);border-radius:3px;background:var(--ep-color-bg-input,#fff);color:inherit;cursor:pointer}
${ELEMENT} button:hover{background:var(--ep-color-bg-hover,#f3f4f6)}
${ELEMENT} button[aria-pressed=true],${ELEMENT} button.primary{background:var(--ep-color-accent-primary,#3b82f6);border-color:var(--ep-color-accent-primary,#3b82f6);color:#fff}
${ELEMENT} button:disabled{opacity:.45;cursor:not-allowed}
${ELEMENT} :is(input,select,button):focus-visible{outline:2px solid #3b82f6;outline-offset:2px}
${ELEMENT} .row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
${ELEMENT} .hint{font-size:12px;line-height:1.5;color:var(--ep-color-fg-secondary,#64748b);margin:0 0 20px}
${ELEMENT} .error{font-size:12px;color:var(--ep-color-danger,#b91c1c);margin:0 0 16px}
${ELEMENT} .actions{display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid var(--ep-color-border-default,#cbd5e1);padding-top:16px}
`;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  if (text) value.textContent = text;
  return value;
}

function defineElement(): void {
  if (typeof customElements === 'undefined' || customElements.get(ELEMENT)) return;
  class CalibrationElement extends HTMLElement {
    private idValue = '';
    private localBridge?: CalibrationSidebarBridge;
    private changed = () => this.renderPanel();
    set documentId(value: string) {this.idValue = value; this.renderPanel();}
    set panelBridge(value: CalibrationSidebarBridge) {this.localBridge = value; this.renderPanel();}
    connectedCallback() {listeners.add(this.changed); this.renderPanel();}
    disconnectedCallback() {listeners.delete(this.changed);}
    private renderPanel() {
      const active = this.localBridge ?? bridge;
      if (!active || !this.idValue) {this.replaceChildren(); return;}
      const scroll = this.querySelector('main')?.scrollTop ?? 0;
      const scope = this.getRootNode();
      const focused = scope instanceof ShadowRoot ? scope.activeElement : this.ownerDocument.activeElement;
      const focusedLabel = focused && this.contains(focused) ? focused.getAttribute('aria-label') : null;
      const snapshot = active.snapshot(this.idValue), draft = snapshot.draft;
      const root = node('main'); root.setAttribute('aria-label', 'Calibragem da escala');
      root.append(node('h2', 'Calibragem da escala'));
      const change = (patch: Partial<CalibrationDraft>) => {
        active.update(this.idValue, patch); this.renderPanel();
      };
      const modes = node('section'), modeLabel = node('label', 'Tipo de escala');
      const choices = node('div'); choices.className = 'row';
      for (const [mode, label] of [['preset', 'Predefinida'], ['custom', 'Personalizada']] as const) {
        const button = node('button', label); button.type = 'button';
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(draft.mode === mode));
        button.onclick = () => change({mode}); choices.append(button);
      }
      modes.append(modeLabel, choices); root.append(modes);
      const select = (label: string, value: string | number, values: readonly {value: string | number; label: string}[], update: (value: string) => void) => {
        const section = node('section'), caption = node('label', label), input = node('select');
        input.setAttribute('aria-label', label);
        for (const option of values) {const item = node('option', option.label); item.value = String(option.value); input.append(item);}
        input.value = String(value); input.onchange = () => update(input.value);
        caption.append(input); section.append(caption); root.append(section);
        return section;
      };
      if (draft.mode === 'preset') {
        const section = select('Escala do projeto', draft.preset, SCALE_PRESETS.map(value => ({value, label: `1:${value}`})), value => change({preset: Number(value)}));
        const shortcuts = node('div'); shortcuts.className = 'row';
        for (const preset of [50, 100]) {const button = node('button', `1:${preset}`); button.type = 'button';
          button.setAttribute('aria-pressed', String(draft.preset === preset)); button.onclick = () => change({preset}); shortcuts.append(button);}
        section.append(shortcuts);
      } else {
        for (const [label, valueKey, unitKey] of [['Medida no papel', 'paperValue', 'paperUnit'], ['Medida real', 'realValue', 'realUnit']] as const) {
          const section = node('section'), caption = node('label', label), input = node('input');
          input.type = 'number'; input.min = '0.0001'; input.step = 'any'; input.value = String(draft[valueKey]); input.setAttribute('aria-label', label);
          // Keep the live input mounted while typing; validate on commit/change.
          input.oninput = () => {
            active.update(this.idValue, {[valueKey]: Number(input.value)});
            const valid = active.snapshot(this.idValue).valid;
            const apply = root.querySelector<HTMLButtonElement>('[data-apply]'); if (apply) apply.disabled = !valid;
          };
          input.onchange = () => this.renderPanel(); caption.append(input); section.append(caption); root.append(section);
          select(`${label}: unidade`, draft[unitKey], CALIBRATION_UNIT_OPTIONS.map(value => ({value: value.value, label: value.value})), value => change({[unitKey]: value}));
        }
      }
      select('Unidade exibida', draft.displayUnit, CALIBRATION_UNIT_OPTIONS.map(value => ({value: value.value, label: value.value})), value => change({displayUnit: value as CalibrationDraft['displayUnit']}));
      select('Precisão', draft.precision, PRECISION_OPTIONS.map(value => ({value, label: precisionLabel(value)})), value => change({precision: Number(value)}));
      const hint = node('p', 'A escala usa o tamanho físico do PDF: 1 ponto corresponde a 1/72 de polegada no papel.'); hint.className = 'hint'; root.append(hint);
      if (!snapshot.valid) {const error = node('p', 'Informe medidas maiores que zero e uma escala válida.'); error.className = 'error'; error.setAttribute('role', 'alert'); root.append(error);}
      const actions = node('div'); actions.className = 'actions';
      const cancel = node('button', 'Cancelar'), apply = node('button', 'Aplicar calibragem');
      cancel.type = apply.type = 'button'; cancel.onclick = () => active.cancel(this.idValue);
      apply.className = 'primary'; apply.dataset['apply'] = ''; apply.disabled = !snapshot.valid;
      apply.onclick = () => active.apply(this.idValue); actions.append(cancel, apply); root.append(actions);
      const style = node('style'); style.textContent = CSS; this.replaceChildren(style, root); root.scrollTop = scroll;
      if (focusedLabel) {
        [...root.querySelectorAll<HTMLElement>('[aria-label]')]
          .find(value => value.getAttribute('aria-label') === focusedLabel)?.focus();
      }
    }
  }
  customElements.define(ELEMENT, CalibrationElement);
}

export function CalibrationSidebar({documentId}: BaseComponentProps) {
  defineElement(); return h(ELEMENT, {documentId});
}

/** Framework-independent visual mount, usable from Angular, React or Vue lifecycle hooks. */
export function mountCalibrationSidebar(host: HTMLElement, documentId: string, value: CalibrationSidebarBridge): {refresh(): void; dispose(): void} {
  defineElement();
  const element = document.createElement(ELEMENT) as HTMLElement & {documentId: string; panelBridge: CalibrationSidebarBridge};
  element.panelBridge = value; element.documentId = documentId; host.append(element);
  return {refresh: () => {element.documentId = documentId;}, dispose: () => element.remove()};
}
