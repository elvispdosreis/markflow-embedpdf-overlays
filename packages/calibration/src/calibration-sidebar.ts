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
let pickerSequence = 0;
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
${ELEMENT}{display:block;height:100%;min-height:0;color:var(--ep-foreground-primary,#111827);font:inherit}
${ELEMENT} *{box-sizing:border-box}
${ELEMENT} main{height:100%;overflow-y:auto;padding:18px 16px;background:var(--ep-background-surface,#fff)}
${ELEMENT} h2{font:inherit;font-weight:var(--font-weight-medium,500);margin:0 0 16px}
${ELEMENT} section{margin:0 0 22px}
${ELEMENT} label{display:block;margin:0 0 8px;font-size:var(--text-sm,.875rem);line-height:var(--text-sm--line-height,1.428571);font-weight:var(--font-weight-medium,500)}
${ELEMENT} input{width:100%;height:30px;padding:0 8px;border:1px solid var(--ep-border-default,#cbd5e1);border-radius:4px;background:var(--ep-background-input,#fff);color:inherit;font:inherit;font-size:var(--text-sm,.875rem);font-weight:var(--font-weight-normal,400)}
${ELEMENT} label input{display:block;margin-top:8px}
${ELEMENT} button{display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:var(--text-sm,.875rem);line-height:var(--text-sm--line-height,1.428571);height:32px;width:auto;min-width:32px;padding:5px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer;transition:background-color .15s,box-shadow .15s}
${ELEMENT} button:hover{background:var(--ep-interactive-hover,#f3f4f6);box-shadow:0 0 0 1px var(--ep-accent-primary,#3b82f6)}
${ELEMENT} button[aria-pressed=true]{background:var(--ep-interactive-selected,#eff6ff);color:var(--ep-accent-primary,#3b82f6);box-shadow:0 0 0 1px var(--ep-accent-primary,#3b82f6),0 1px 3px #0000001a}
${ELEMENT} button.primary{background:var(--ep-accent-primary,#3b82f6);color:var(--ep-foreground-on-accent,#fff)}
${ELEMENT} button.primary:hover{background:var(--ep-accent-primary-hover,#2563eb)}
${ELEMENT} button:disabled{opacity:.5;cursor:not-allowed}
${ELEMENT} button:disabled:hover{box-shadow:none}
${ELEMENT} :is(input,button):focus-visible{outline:2px solid var(--ep-interactive-focus-ring,#3b82f6);outline-offset:2px}
${ELEMENT} .picker{position:relative;width:100%}
${ELEMENT} .picker-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:30px;padding:4px 8px;border:1px solid var(--ep-border-default,#cbd5e1);border-radius:4px;background:var(--ep-background-input,#fff);text-align:left}
${ELEMENT} .picker-trigger:hover{background:var(--ep-background-input,#fff);box-shadow:none}
${ELEMENT} .picker-trigger svg{width:16px;height:16px;color:var(--ep-foreground-secondary,#64748b);flex-shrink:0}
${ELEMENT} .picker-menu{position:absolute;z-index:10;top:calc(100% + 4px);width:100%;max-height:240px;overflow-y:auto;padding:4px;border:1px solid var(--ep-border-default,#cbd5e1);border-radius:4px;background:var(--ep-background-elevated,#fff);box-shadow:0 10px 15px -3px #0000001a,0 4px 6px -4px #0000001a}
${ELEMENT} .picker-menu.above{top:auto;bottom:calc(100% + 4px)}
${ELEMENT} .picker-menu[hidden]{display:none}
${ELEMENT} .picker-option{display:block;width:100%;height:auto;min-height:32px;border:0;border-radius:4px;text-align:left;font-size:inherit;line-height:inherit;padding:4px 8px;background:transparent}
${ELEMENT} .picker-option:hover{box-shadow:none}
${ELEMENT} .picker-option[aria-selected=true],${ELEMENT} .picker-option:hover{background:var(--ep-interactive-hover,#f3f4f6)}
${ELEMENT} .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
${ELEMENT} .hint{font-size:var(--text-xs,.75rem);line-height:var(--text-xs--line-height,1.333333);color:var(--ep-foreground-muted,#64748b);margin:0 0 20px}
${ELEMENT} .error{font-size:var(--text-xs,.75rem);color:var(--ep-state-error,#b91c1c);margin:0 0 16px}
${ELEMENT} .actions{display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid var(--ep-border-default,#cbd5e1);padding-top:16px}
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
    private closePicker?: () => void;
    private outside = (event: PointerEvent) => {
      if (!event.composedPath().some(value => value instanceof HTMLElement && value.classList.contains('picker'))) this.closePicker?.();
    };
    set documentId(value: string) {this.idValue = value; this.renderPanel();}
    set panelBridge(value: CalibrationSidebarBridge) {this.localBridge = value; this.renderPanel();}
    connectedCallback() {listeners.add(this.changed); this.ownerDocument.addEventListener('pointerdown', this.outside, true); this.renderPanel();}
    disconnectedCallback() {listeners.delete(this.changed); this.ownerDocument.removeEventListener('pointerdown', this.outside, true); this.closePicker = undefined;}
    private renderPanel() {
      this.closePicker?.(); this.closePicker = undefined;
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
        const section = node('section'), caption = node('label', label), picker = node('div'), input = node('button');
        picker.className = 'picker'; input.className = 'picker-trigger'; input.type = 'button';
        input.setAttribute('role', 'combobox'); input.setAttribute('aria-label', label);
        input.setAttribute('aria-haspopup', 'listbox'); input.setAttribute('aria-expanded', 'false');
        input.append(node('span', values.find(option => String(option.value) === String(value))?.label ?? String(value)));
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); arrow.setAttribute('viewBox', '0 0 20 20'); arrow.setAttribute('fill', 'currentColor'); arrow.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z'); arrow.append(path); input.append(arrow);
        const menu = node('div'); menu.className = 'picker-menu'; menu.hidden = true; menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', label);
        menu.id = `markflow-calibration-options-${++pickerSequence}`; input.setAttribute('aria-controls', menu.id);
        const options: HTMLButtonElement[] = [];
        const close = () => {menu.hidden = true; input.setAttribute('aria-expanded', 'false');};
        const open = () => {
          this.closePicker?.(); this.closePicker = close; menu.hidden = false; input.setAttribute('aria-expanded', 'true');
          const room = root.getBoundingClientRect().bottom - input.getBoundingClientRect().bottom;
          menu.classList.toggle('above', room < Math.min(values.length * 32 + 10, 240));
          (options.find(option => option.getAttribute('aria-selected') === 'true') ?? options[0])?.focus();
        };
        for (const option of values) {
          const item = node('button', option.label); item.type = 'button'; item.className = 'picker-option'; item.setAttribute('role', 'option');
          item.tabIndex = -1;
          item.dataset['value'] = String(option.value); item.setAttribute('aria-selected', String(String(option.value) === String(value)));
          item.onclick = () => {close(); input.focus(); update(String(option.value));}; options.push(item); menu.append(item);
        }
        input.onclick = () => menu.hidden ? open() : close();
        picker.onkeydown = event => {
          if (event.key === 'Escape' && !menu.hidden) {event.preventDefault(); event.stopPropagation(); close(); input.focus();}
          else if (event.key === 'Tab') close();
          else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (menu.hidden) {open(); return;}
            const current = options.indexOf((this.getRootNode() as Document | ShadowRoot).activeElement as HTMLButtonElement);
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            options[index]?.focus();
          }
        };
        picker.addEventListener('focusout', event => {if (!picker.contains(event.relatedTarget as Node | null)) close();});
        picker.append(input, menu); section.append(caption, picker); root.append(section);
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
