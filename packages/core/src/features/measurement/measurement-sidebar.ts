import {navigateToMeasurement, adjacentMeasurement, MeasurementSidebarSelection} from './measurement-sidebar-controller';
export {navigateToMeasurement, adjacentMeasurement} from './measurement-sidebar-controller';
import type {BaseComponentProps} from '@embedpdf/plugin-ui/preact';
import {h} from 'preact';
import {
  getMeasurementSidebarBridge,
  subscribeMeasurementSidebar,
  type MeasurementSidebarBridge
} from './measurement-sidebar-bridge';
import {MEASUREMENT_I18N_KEYS, MEASUREMENT_SIDEBAR_I18N_KEYS} from './measurement-i18n';
import type {MeasurementSidebarItem} from './measurement-sidebar.models';


const ELEMENT_NAME = 'markflow-measurements-sidebar-view';
const kindKeys = {
  distance: MEASUREMENT_I18N_KEYS.distance,
  perimeter: MEASUREMENT_I18N_KEYS.perimeter,
  area: MEASUREMENT_I18N_KEYS.area,
  'rectangle-area': MEASUREMENT_I18N_KEYS.rectangleArea,
  ellipse: MEASUREMENT_I18N_KEYS.ellipse,
  arc: MEASUREMENT_I18N_KEYS.arc
} as const;

const kindGlyphs: Record<MeasurementSidebarItem['kind'], string> = {
  distance: '↔', perimeter: '⌁', area: '△', 'rectangle-area': '□', ellipse: '○', arc: '⌒'
};

export function measurementKindGlyph(kind: MeasurementSidebarItem['kind']): string {
  return kindGlyphs[kind];
}

const SIDEBAR_STYLES = `
  markflow-measurements-sidebar-view{display:block;height:100%;min-height:0;color:#172033}
  markflow-measurements-sidebar-view *{box-sizing:border-box}
  markflow-measurements-sidebar-view .markflow-root{display:flex;height:100%;min-height:0;flex-direction:column;background:#fff}
  markflow-measurements-sidebar-view .markflow-header{display:flex;align-items:center;justify-content:space-between;min-height:62px;padding:12px 16px;border-bottom:1px solid #e5e9f0}
  markflow-measurements-sidebar-view .markflow-title-row{display:flex;align-items:center;gap:8px}
  markflow-measurements-sidebar-view .markflow-count{display:inline-flex;min-width:22px;height:20px;align-items:center;justify-content:center;border-radius:10px;padding:0 7px;background:#eef2f7;color:#526075;font-size:11px;font-weight:600}
  markflow-measurements-sidebar-view .markflow-nav{display:flex;gap:6px}
  markflow-measurements-sidebar-view .markflow-nav button{display:grid;width:30px;height:30px;place-items:center;border:1px solid #dce2ea;border-radius:7px;background:#fff;color:#42516a;cursor:pointer}
  markflow-measurements-sidebar-view .markflow-nav button:hover:not(:disabled){background:#f3f6fa;border-color:#c7d0dc}
  markflow-measurements-sidebar-view .markflow-nav button:disabled{opacity:.35;cursor:default}
  markflow-measurements-sidebar-view .markflow-list{min-height:0;flex:1;overflow-y:auto;margin:0;padding:10px;list-style:none}
  markflow-measurements-sidebar-view .markflow-list>li+li{margin-top:7px}
  markflow-measurements-sidebar-view .markflow-card{overflow:hidden;border:1px solid #e0e5ec;border-radius:9px;background:#fff;transition:border-color .15s,box-shadow .15s}
  markflow-measurements-sidebar-view .markflow-card:hover{border-color:#c6cfdb}
  markflow-measurements-sidebar-view .markflow-card.markflow-selected{border-color:#6b8fdc;box-shadow:0 0 0 1px rgba(74,112,194,.08)}
  markflow-measurements-sidebar-view .markflow-summary{display:flex;width:100%;align-items:center;gap:10px;padding:10px 11px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
  markflow-measurements-sidebar-view .markflow-kind-icon{display:grid;width:30px;height:30px;flex:0 0 30px;place-items:center;border-radius:7px;background:#f3f6fa;color:#465a78;font-size:18px}
  markflow-measurements-sidebar-view .markflow-selected .markflow-kind-icon{background:#eaf0ff;color:#315fb5}
  markflow-measurements-sidebar-view .markflow-meta{display:flex;min-width:0;flex:1;align-items:center;justify-content:space-between;gap:8px}
  markflow-measurements-sidebar-view .markflow-kind{overflow:hidden;color:#4d5b70;font-size:12px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}
  markflow-measurements-sidebar-view .markflow-value{display:block;margin-top:2px;font-size:16px;font-weight:650;font-variant-numeric:tabular-nums}
  markflow-measurements-sidebar-view .markflow-selected .markflow-summary .markflow-value{display:none}
  markflow-measurements-sidebar-view .markflow-page{flex:none;color:#7a8799;font-size:11px}
  markflow-measurements-sidebar-view .markflow-details{padding:0 11px 12px;border-top:1px solid #edf0f4;background:#fbfcfe}
  markflow-measurements-sidebar-view .markflow-hero{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding:12px 0 10px}
  markflow-measurements-sidebar-view .markflow-hero-label{color:#68768a;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
  markflow-measurements-sidebar-view .markflow-hero-value{margin-top:2px;font-size:21px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  markflow-measurements-sidebar-view .markflow-color-dot{width:10px;height:10px;flex:none;border-radius:50%}
  markflow-measurements-sidebar-view .markflow-delete-measurement{position:absolute;top:7px;right:0;display:grid;width:28px;height:28px;place-items:center;border:0;border-radius:6px;background:transparent;color:#dc2626;font-size:21px;line-height:1;cursor:pointer}
  markflow-measurements-sidebar-view .markflow-delete-measurement:hover,markflow-measurements-sidebar-view .markflow-delete-measurement:focus-visible{background:#fef2f2}
  markflow-measurements-sidebar-view .markflow-data-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;overflow:hidden;border:1px solid #e5e9ef;border-radius:7px;background:#e5e9ef}
  markflow-measurements-sidebar-view .markflow-data-cell{position:relative;min-width:0;padding:8px 9px;background:#fff}
  markflow-measurements-sidebar-view .markflow-data-cell[role="button"]{cursor:pointer;outline:none}
  markflow-measurements-sidebar-view .markflow-data-cell[role="button"]:hover,markflow-measurements-sidebar-view .markflow-data-cell[role="button"]:focus-visible{background:#eef5ff}
  markflow-measurements-sidebar-view .markflow-data-cell.markflow-detail-active{background:#dbeafe;box-shadow:inset 0 0 0 2px #3b82f6}
  markflow-measurements-sidebar-view .markflow-data-cell:last-child:nth-child(odd){grid-column:1/-1}
  markflow-measurements-sidebar-view .markflow-data-cell dt{overflow:hidden;color:#778398;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
  markflow-measurements-sidebar-view .markflow-data-cell dd{overflow:hidden;margin:2px 0 0;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap}
  markflow-measurements-sidebar-view .markflow-data-cell:has(.markflow-delete-detail){padding-right:31px}
  markflow-measurements-sidebar-view .markflow-delete-detail{position:absolute;top:5px;right:5px;display:grid;width:22px;height:22px;place-items:center;padding:0;border:0;border-radius:4px;background:transparent;color:#b91c1c;font-size:18px;line-height:1;cursor:pointer}
  markflow-measurements-sidebar-view .markflow-delete-detail:hover:not(:disabled),markflow-measurements-sidebar-view .markflow-delete-detail:focus-visible{background:#fee2e2}
  markflow-measurements-sidebar-view .markflow-delete-detail:disabled{opacity:.4;cursor:not-allowed}
  markflow-measurements-sidebar-view .markflow-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:11px;padding-top:11px;border-top:1px solid #e5e9ef}
  markflow-measurements-sidebar-view .markflow-control{min-width:0;color:#68768a;font-size:10px;font-weight:500}
  markflow-measurements-sidebar-view .markflow-control input:not([type=color]),markflow-measurements-sidebar-view .markflow-control select{width:100%;height:32px;margin-top:4px;padding:0 8px;border:1px solid #d8dee8;border-radius:6px;background:#fff;color:#172033;font-size:12px;font-variant-numeric:tabular-nums;outline:none}
  markflow-measurements-sidebar-view .markflow-control input:focus,markflow-measurements-sidebar-view .markflow-control select:focus{border-color:#5b7fc8;box-shadow:0 0 0 2px rgba(91,127,200,.12)}
  markflow-measurements-sidebar-view .markflow-color-control{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between}
  markflow-measurements-sidebar-view .markflow-color-control input{width:34px;height:26px;padding:2px;border:1px solid #d8dee8;border-radius:6px;background:#fff;cursor:pointer}
`;

export function MeasurementSidebar({documentId}: BaseComponentProps) {
  defineMeasurementSidebarElement();
  return h(ELEMENT_NAME, {documentId});
}

function defineMeasurementSidebarElement(): void {
  if (typeof customElements === 'undefined' || customElements.get(ELEMENT_NAME)) return;

  class MeasurementSidebarElement extends HTMLElement {
    private currentDocumentId = '';
    private readonly selection = new MeasurementSidebarSelection();
    private get expandedId(): string | null {return this.selection.expandedId;}
    private set expandedId(value: string | null) {this.selection.expandedId = value;}
    private get activeDetail(): string | null {return this.selection.activeDetail;}
    private set activeDetail(value: string | null) {this.selection.activeDetail = value;}
    private unsubscribe?: () => void;

    set documentId(value: string) {
      this.currentDocumentId = value;
      this.selection.setDocument(value);
      this.renderSidebar();
    }

    get documentId(): string {
      return this.currentDocumentId;
    }

    connectedCallback(): void {
      this.className = 'block h-full min-h-0';
      this.unsubscribe = subscribeMeasurementSidebar(() => this.renderSidebar());
      this.renderSidebar();
    }

    disconnectedCallback(): void {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    }

    private renderSidebar(): void {
      const bridge = getMeasurementSidebarBridge();
      if (!bridge || !this.currentDocumentId) return;
      const scrollTop = this.querySelector<HTMLElement>('.markflow-list')?.scrollTop ?? 0;
      const root = this.getRootNode();
      const activeElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
      const focusKey = activeElement instanceof HTMLElement && this.contains(activeElement)
        ? activeElement.dataset['focusKey'] : undefined;
      const previousExpandedId = this.expandedId;
      const snapshot = bridge.snapshot(this.currentDocumentId);
      this.selection.synchronize(snapshot);
      const selectedIndex = snapshot.items.findIndex(item => item.id === (this.expandedId ?? snapshot.selectedId));
      const section = node('section', 'markflow-root');
      section.append(this.header(bridge, snapshot.items, snapshot.selectedId, selectedIndex));
      section.append(snapshot.items.length
        ? this.list(bridge, snapshot.items, snapshot.selectedId)
        : this.emptyState(bridge));
      const styles = document.createElement('style'); styles.textContent = SIDEBAR_STYLES;
      this.replaceChildren(styles, section);
      const list = this.querySelector<HTMLElement>('.markflow-list');
      if (list) list.scrollTop = scrollTop;
      if (focusKey && previousExpandedId === this.expandedId) {
        const control = Array.from(this.querySelectorAll<HTMLElement>('[data-focus-key]'))
          .find(element => element.dataset['focusKey'] === focusKey);
        control?.focus({preventScroll: true});
      }
    }

    private t(bridge: MeasurementSidebarBridge, key: string, fallback: string): string {
      return bridge.translate(this.currentDocumentId, key, fallback);
    }

    private header(
      bridge: MeasurementSidebarBridge,
      items: MeasurementSidebarItem[],
      selectedId: string | null,
      selectedIndex: number
    ): HTMLElement {
      const header = node('header', 'markflow-header');
      const title = node('div', 'markflow-title-row');
      title.append(
        node('h2', 'text-sm font-semibold', this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.title, 'Medições')),
        node('span', 'markflow-count', String(items.length))
      );
      const navigation = node('div', 'markflow-nav');
      navigation.append(
        this.navigationButton(bridge, '←', MEASUREMENT_SIDEBAR_I18N_KEYS.previous, 'Medição anterior', selectedIndex <= 0, () => {
          const target = adjacentMeasurement(items, this.expandedId ?? selectedId, -1);
          if (target) this.navigate(bridge, target);
        }),
        this.navigationButton(bridge, '→', MEASUREMENT_SIDEBAR_I18N_KEYS.next, 'Próxima medição', selectedIndex < 0 || selectedIndex >= items.length - 1, () => {
          const target = adjacentMeasurement(items, this.expandedId ?? selectedId, 1);
          if (target) this.navigate(bridge, target);
        })
      );
      header.append(title, navigation);
      return header;
    }

    private navigationButton(
      bridge: MeasurementSidebarBridge, label: string, key: string, fallback: string,
      disabled: boolean, action: () => void
    ): HTMLButtonElement {
      const title = this.t(bridge, key, fallback);
      const button = node('button', '', label) as HTMLButtonElement;
      button.dataset['focusKey'] = key;
      button.type = 'button'; button.title = title; button.ariaLabel = title; button.disabled = disabled;
      button.addEventListener('click', action);
      return button;
    }

    private emptyState(bridge: MeasurementSidebarBridge): HTMLElement {
      const empty = node('div', 'flex flex-1 flex-col items-center justify-center px-6 text-center');
      empty.append(
        node('p', 'text-sm font-medium', this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.empty, 'Nenhuma medição')),
        node('p', 'mt-1 text-xs text-fg-secondary', this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.emptyHint, 'Escolha uma ferramenta e desenhe sobre o PDF.'))
      );
      return empty;
    }

    private list(bridge: MeasurementSidebarBridge, items: MeasurementSidebarItem[], selectedId: string | null): HTMLElement {
      const list = node('ol', 'markflow-list');
      for (const item of items) {
        const expanded = item.id === this.expandedId;
        const selected = item.id === selectedId;
        const row = node('button', 'markflow-summary') as HTMLButtonElement;
        row.type = 'button'; row.ariaExpanded = String(expanded);
        row.dataset['focusKey'] = item.id;
        if (selected) row.setAttribute('aria-current', 'true');
        const icon = node('span', 'markflow-kind-icon', measurementKindGlyph(item.kind));
        icon.setAttribute('aria-hidden', 'true');
        const summary = node('span', 'min-w-0 flex-1');
        const heading = node('span', 'markflow-meta');
        heading.append(
          node('span', 'markflow-kind', this.t(bridge, kindKeys[item.kind], item.kind)),
          node('span', 'markflow-page', `${this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.page, 'Página')} ${item.pageIndex + 1}`)
        );
        summary.append(heading, node('strong', 'markflow-value', item.formattedValue));
        row.append(icon, summary);
        row.addEventListener('click', () => this.navigate(bridge, item));
        const article = node('article', `markflow-card${selected ? ' markflow-selected' : ''}`);
        article.append(row);
        if (expanded) article.append(this.details(bridge, item));
        const entry = document.createElement('li'); entry.append(article); list.append(entry);
      }
      return list;
    }

    private navigate(bridge: MeasurementSidebarBridge, item: MeasurementSidebarItem): void {
      this.expandedId = item.id;
      this.activeDetail = null;
      bridge.highlightDetail?.(this.currentDocumentId, item, null);
      bridge.navigate(this.currentDocumentId, item);
      this.renderSidebar();
    }

    private details(bridge: MeasurementSidebarBridge, item: MeasurementSidebarItem): HTMLElement {
      const wrapper = node('div', 'markflow-details');
      const hero = node('div', 'markflow-hero');
      const heroText = node('div', 'min-w-0');
      heroText.append(
        node('div', 'markflow-hero-label', this.t(bridge, kindKeys[item.kind], item.kind)),
        node('div', 'markflow-hero-value', item.formattedValue)
      );
      const colorDot = node('span', 'markflow-color-dot'); colorDot.style.backgroundColor = item.strokeColor;
      hero.append(heroText, colorDot);
      if (bridge.deleteMeasurement) {
        const label = this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.deleteMeasurement, 'Excluir medição');
        const remove = node('button', 'markflow-delete-measurement', '×') as HTMLButtonElement;
        remove.type = 'button';
        remove.title = label;
        remove.setAttribute('aria-label', label);
        remove.addEventListener('click', () => {
          this.activeDetail = null;
          this.expandedId = null;
          bridge.deleteMeasurement?.(this.currentDocumentId, item);
          this.renderSidebar();
        });
        hero.append(remove);
      }
      const details = node('dl', 'markflow-data-grid');
      const rows = [...item.detailRows,
        {labelKey: MEASUREMENT_SIDEBAR_I18N_KEYS.unit, value: item.calibration.unit},
        {labelKey: MEASUREMENT_SIDEBAR_I18N_KEYS.scale, value: `1 pt = ${item.calibration.linearFactor.toLocaleString('pt-BR')} ${item.calibration.unit}`}
      ];
      for (const row of rows) {
        const line = node('div', 'markflow-data-cell');
        if (row.highlight && bridge.highlightDetail) {
          const detailKey = `${item.id}:${row.highlight.kind}:${row.highlight.index}`;
          line.setAttribute('role', 'button');
          line.tabIndex = 0;
          line.dataset['focusKey'] = detailKey;
          line.classList.toggle('markflow-detail-active', this.activeDetail === detailKey);
          const activate = () => {
            this.activeDetail = detailKey;
            this.expandedId = item.id;
            bridge.navigate(this.currentDocumentId, item);
            bridge.highlightDetail?.(this.currentDocumentId, item, row);
            this.renderSidebar();
          };
          line.addEventListener('click', activate);
          line.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            activate();
          });
        }
        line.append(
          node('dt', '', this.t(bridge, row.labelKey, row.labelKey)),
          node('dd', '', row.value)
        );
        if (row.highlight && this.activeDetail === `${item.id}:${row.highlight.kind}:${row.highlight.index}`) {
          const {kind, index} = row.highlight;
          const removeDetail = kind === 'vertex' && item.kind === 'area' ? bridge.deleteVertex
            : kind === 'segment' && item.kind === 'perimeter' ? bridge.deleteSegment : undefined;
          if (removeDetail) {
            const action = kind === 'vertex' ? MEASUREMENT_SIDEBAR_I18N_KEYS.deleteVertex : MEASUREMENT_SIDEBAR_I18N_KEYS.deleteSegment;
            const label = `${this.t(bridge, action, kind === 'vertex' ? 'Excluir vértice' : 'Excluir segmento')} ${index + 1}`;
            const remove = node('button', 'markflow-delete-detail', '×') as HTMLButtonElement;
            remove.type = 'button';
            remove.setAttribute('aria-label', label);
            remove.title = label;
            if (kind === 'vertex') {
              const vertexCount = Number(item.detailRows.find(detail => detail.labelKey === MEASUREMENT_SIDEBAR_I18N_KEYS.vertices)?.value);
              remove.disabled = vertexCount <= 3;
            }
            remove.addEventListener('click', event => {
              event.stopPropagation();
              removeDetail(this.currentDocumentId, item, index);
              this.activeDetail = null;
              this.renderSidebar();
            });
            remove.addEventListener('keydown', event => event.stopPropagation());
            line.append(remove);
          }
        }
        details.append(line);
      }
      wrapper.append(hero, details);
      const editableKind = item.kind === 'distance' || item.kind === 'arc' ? item.kind : null;
      if (editableKind) wrapper.append(this.editControls(bridge, item, editableKind));
      return wrapper;
    }

    private editControls(bridge: MeasurementSidebarBridge, item: MeasurementSidebarItem, kind: 'distance' | 'arc'): HTMLElement {
      const controls = node('div', 'markflow-controls');
      if (kind === 'distance' && bridge.setDistanceValue) controls.append(this.input(
        this.t(bridge, MEASUREMENT_I18N_KEYS.distance, 'Distância'), item.formattedValue.replace(/\s.*$/, ''),
        value => bridge.setDistanceValue?.(value)
      ));
      if (kind === 'distance' && bridge.setDistanceAngle) controls.append(this.input(
        this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.angle, 'Ângulo'),
        item.detailRows.find(row => row.labelKey === MEASUREMENT_SIDEBAR_I18N_KEYS.angle)?.value.replace('°', '') ?? '0',
        value => bridge.setDistanceAngle?.(value)
      ));
      if (bridge.setPrecision) {
        const label = node('label', 'markflow-control', this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.precision, 'Precisão'));
        const select = node('select', '') as HTMLSelectElement;
        select.dataset['focusKey'] = 'precision';
        for (const value of [0, 1, 2, 3, 4]) {
          const option = document.createElement('option'); option.value = String(value); option.textContent = String(value); option.selected = value === item.calibration.precision; select.append(option);
        }
        select.addEventListener('change', () => bridge.setPrecision?.(item, Number(select.value)));
        label.append(select); controls.append(label);
      }
      if (bridge.setStrokeWidth) controls.append(this.input(
        this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.thickness, 'Espessura'), String(item.strokeWidth),
        value => bridge.setStrokeWidth?.(kind, Number(value)), 'number'
      ));
      if (bridge.setStrokeColor) {
        const label = node('label', 'markflow-control markflow-color-control', this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.color, 'Cor'));
        const color = document.createElement('input'); color.type = 'color'; color.value = item.strokeColor; color.ariaLabel = this.t(bridge, MEASUREMENT_SIDEBAR_I18N_KEYS.color, 'Cor');
        color.dataset['focusKey'] = 'color';
        color.addEventListener('change', () => bridge.setStrokeColor?.(kind, color.value)); label.append(color); controls.append(label);
      }
      return controls;
    }

    private input(labelText: string, value: string, change: (value: string) => void, type = 'text'): HTMLElement {
      const label = node('label', 'markflow-control', labelText);
      const input = node('input', '') as HTMLInputElement;
      input.dataset['focusKey'] = labelText;
      if (type === 'number') { input.min = '0.5'; input.max = '10'; input.step = '0.5'; }
      input.type = type; input.value = value; input.addEventListener('change', () => change(input.value)); label.append(input);
      return label;
    }
  }

  customElements.define(ELEMENT_NAME, MeasurementSidebarElement);
}

function node(tag: string, className: string, text?: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
