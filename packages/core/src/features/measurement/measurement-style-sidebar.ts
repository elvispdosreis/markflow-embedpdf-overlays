import {PdfAnnotationBorderStyle, PdfAnnotationLineEnding} from '@embedpdf/snippet';
import type {BaseComponentProps} from '@embedpdf/plugin-ui/preact';
import {h} from 'preact';
import {
  getMeasurementStyleBridge,
  subscribeMeasurementStyle,
  type MeasurementStyleBridge,
  type MeasurementStyleSnapshot
} from './measurement-style-bridge';
import {measurementStyleProperties, type MeasurementStyleProperty} from './measurement-style.models';
import {MEASUREMENT_FILL_PATTERNS} from './measurement-fill';

const ELEMENT_NAME = 'markflow-measurement-style-view';

const STYLES = `
  markflow-measurement-style-view{display:block;height:100%;min-height:0;color:var(--ep-color-fg-primary,#172033)}
  markflow-measurement-style-view *{box-sizing:border-box}
  markflow-measurement-style-view .markflow-style-root{height:100%;overflow-y:auto;padding:18px 20px;background:var(--ep-color-bg-surface,#fff)}
  markflow-measurement-style-view h2{margin:0 0 20px;font-size:16px;font-weight:600}
  markflow-measurement-style-view section{margin:0 0 20px}
  markflow-measurement-style-view label{display:block;margin-bottom:10px;font-size:14px;font-weight:500}
  markflow-measurement-style-view .markflow-colors{display:flex;flex-wrap:wrap;gap:14px}
  markflow-measurement-style-view .markflow-color{position:relative;width:25px;height:25px;padding:0;border:1px solid #aeb8c7;border-radius:50%;background:var(--swatch);cursor:pointer}
  markflow-measurement-style-view .markflow-color[data-transparent=true]{background:#fff linear-gradient(45deg,transparent 43%,#ef4444 44%,#ef4444 56%,transparent 57%)}
  markflow-measurement-style-view .markflow-color[aria-pressed=true]::after{content:'';position:absolute;inset:-5px;border:2px solid #3282ff;border-radius:50%}
  markflow-measurement-style-view input[type=range]{width:100%;height:4px;margin:8px 0 7px;accent-color:#1677ff}
  markflow-measurement-style-view .markflow-value{color:var(--ep-color-fg-secondary,#667085);font-size:12px}
  markflow-measurement-style-view select,markflow-measurement-style-view input[type=number]{width:100%;height:40px;padding:0 12px;border:1px solid var(--ep-color-border-default,#d5dbe5);border-radius:5px;background:var(--ep-color-bg-input,#fff);color:inherit;font:inherit}
  markflow-measurement-style-view .markflow-endings{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  markflow-measurement-style-view .markflow-rotation{display:grid;grid-template-columns:40px 1fr 40px;gap:6px}
  markflow-measurement-style-view .markflow-rotation button{height:40px;border:1px solid var(--ep-color-border-default,#d5dbe5);border-radius:5px;background:var(--ep-color-bg-input,#fff);font-size:20px;cursor:pointer}
  markflow-measurement-style-view .markflow-empty{padding:24px 0;color:var(--ep-color-fg-secondary,#667085);font-size:13px;text-align:center}
  markflow-measurement-style-view .markflow-patterns{display:flex;flex-wrap:wrap;gap:14px}
  markflow-measurement-style-view .markflow-pattern{position:relative;width:25px;height:25px;padding:0;border:1px solid #aeb8c7;border-radius:50%;background:var(--ep-color-bg-input,#fff);cursor:pointer}
  markflow-measurement-style-view .markflow-pattern[aria-pressed=true]::after{content:'';position:absolute;inset:-5px;border:2px solid #3282ff;border-radius:50%}
  markflow-measurement-style-view .markflow-pattern:focus-visible{outline:2px solid #1677ff;outline-offset:2px}
  markflow-measurement-style-view .markflow-pattern-preview{display:block;width:100%;height:100%;border-radius:50%;background-color:var(--ep-color-bg-input,#fff);color:var(--pattern-color,#E44234)}
`;

const FALLBACK_COLORS = ['#E44234', '#FF8D00', '#FFCD45', '#5CC96E', '#36C2C9', '#5578D7', '#B83FCB', '#893228', '#000000', '#FFFFFF'];

export function MeasurementStyleSidebar({documentId}: BaseComponentProps) {
  defineMeasurementStyleElement();
  return h(ELEMENT_NAME, {documentId});
}

function defineMeasurementStyleElement(): void {
  if (typeof customElements === 'undefined' || customElements.get(ELEMENT_NAME)) return;

  class MeasurementStyleElement extends HTMLElement {
    private currentDocumentId = '';
    private unsubscribe?: () => void;

    set documentId(value: string) {
      this.currentDocumentId = value;
      this.renderPanel();
    }

    get documentId(): string {
      return this.currentDocumentId;
    }

    connectedCallback(): void {
      this.className = 'block h-full min-h-0';
      this.unsubscribe = subscribeMeasurementStyle(() => this.renderPanel());
      this.renderPanel();
    }

    disconnectedCallback(): void {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    }

    private renderPanel(): void {
      const bridge = getMeasurementStyleBridge();
      if (!bridge || !this.currentDocumentId) return;
      const snapshot = bridge.snapshot(this.currentDocumentId);
      const root = node('main', 'markflow-style-root');
      if (!snapshot) {
        root.append(node('div', 'markflow-empty', this.t(bridge, 'annotation.noSelection', 'Selecione uma medição.')));
      } else {
        const title = this.t(bridge, 'annotation.styles', 'Estilos de {type}')
          .replace('{type}', snapshot.label);
        root.append(node('h2', '', title));
        for (const property of measurementStyleProperties(snapshot.kind)) {
          root.append(this.property(bridge, snapshot, property));
        }
      }
      const style = document.createElement('style');
      style.textContent = STYLES;
      this.replaceChildren(style, root);
    }

    private property(
      bridge: MeasurementStyleBridge,
      snapshot: MeasurementStyleSnapshot,
      property: MeasurementStyleProperty
    ): HTMLElement {
      const section = node('section');
      section.dataset['styleProperty'] = property;
      const update = (value: unknown) => {
        bridge.update(this.currentDocumentId, property, value);
        this.renderPanel();
      };
      switch (property) {
        case 'color':
          return this.colorProperty(section, bridge, 'annotation.fillColor', 'Cor de preenchimento', snapshot.values.color ?? 'transparent', update, true);
        case 'fillPattern':
          return this.fillPatternProperty(section, snapshot, update);
        case 'strokeColor':
          return this.colorProperty(section, bridge, 'annotation.strokeColor', 'Cor do traço', snapshot.values.strokeColor ?? '#E44234', update, true);
        case 'opacity':
          return this.rangeProperty(section, bridge, 'annotation.opacity', 'Opacidade', snapshot.values.opacity ?? 1, 0.1, 1, 0.05, value => `${Math.round(value * 100)}%`, update);
        case 'strokeWidth':
          return this.rangeProperty(section, bridge, 'annotation.strokeWidth', 'Espessura do traço', snapshot.values.strokeWidth ?? 1, 1, 30, 1, value => `${value}px`, update);
        case 'strokeStyle':
          return this.strokeStyleProperty(section, bridge, snapshot.values.strokeStyle ?? PdfAnnotationBorderStyle.SOLID, update);
        case 'lineEndings':
          return this.lineEndingsProperty(section, bridge, snapshot, update);
        case 'rotation':
          return this.rotationProperty(section, bridge, snapshot.values.rotation ?? 0, update);
      }
    }

    private fillPatternProperty(section: HTMLElement, snapshot: MeasurementStyleSnapshot, update: (value: unknown) => void): HTMLElement {
      section.append(node('label', '', 'Tipo de preenchimento'));
      const options = node('div', 'markflow-patterns');
      const color = snapshot.values.color && snapshot.values.color !== 'transparent'
        ? snapshot.values.color : snapshot.values.strokeColor ?? '#E44234';
      const stripe = (angle: number) => `repeating-linear-gradient(${angle}deg,transparent 0 5px,currentColor 5px 6px)`;
      for (const {value, label} of MEASUREMENT_FILL_PATTERNS) {
        const button = node('button', 'markflow-pattern') as HTMLButtonElement;
        button.type = 'button'; button.ariaLabel = label; button.title = label;
        button.setAttribute('aria-pressed', String(value === (snapshot.values.fillPattern ?? 'solid')));
        const preview = node('span', 'markflow-pattern-preview');
        preview.setAttribute('aria-hidden', 'true'); preview.style.setProperty('--pattern-color', color);
        if (value === 'crosses') {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path d="M2 2L6 6M2 6L6 2" fill="none" stroke="${color}" stroke-width="1"/></svg>`;
          preview.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
          preview.style.backgroundSize = '8px 8px';
        }
        else if (value === 'solid') preview.style.backgroundColor = color;
        else preview.style.backgroundImage = value === 'dots' ? 'radial-gradient(circle,currentColor 1px,transparent 1.5px)'
          : value === 'crosshatch' ? `${stripe(45)},${stripe(-45)}` : stripe(value === 'horizontal' ? 0 : value === 'vertical' ? 90 : 45);
        if (value === 'dots') preview.style.backgroundSize = '7px 7px';
        button.append(preview);
        button.addEventListener('click', () => update(value)); options.append(button);
      }
      section.append(options); return section;
    }

    private colorProperty(
      section: HTMLElement, bridge: MeasurementStyleBridge, key: string, fallback: string,
      value: string, update: (value: unknown) => void, transparent: boolean
    ): HTMLElement {
      section.append(node('label', '', this.t(bridge, key, fallback)));
      const colors = node('div', 'markflow-colors');
      const configuredPresets = bridge.colorPresets();
      const presets = configuredPresets.length ? configuredPresets : FALLBACK_COLORS;
      for (const color of transparent ? [...presets, 'transparent'] : presets) {
        const button = node('button', 'markflow-color') as HTMLButtonElement;
        button.type = 'button';
        button.dataset['color'] = color;
        button.dataset['transparent'] = String(color === 'transparent');
        button.style.setProperty('--swatch', color);
        button.ariaLabel = color === 'transparent' ? 'Sem preenchimento' : color;
        button.setAttribute('aria-pressed', String(color.toLowerCase() === value.toLowerCase()));
        button.addEventListener('click', () => update(color));
        colors.append(button);
      }
      section.append(colors);
      return section;
    }

    private rangeProperty(
      section: HTMLElement, bridge: MeasurementStyleBridge, key: string, fallback: string,
      value: number, min: number, max: number, step: number,
      format: (value: number) => string, update: (value: unknown) => void
    ): HTMLElement {
      section.append(node('label', '', this.t(bridge, key, fallback)));
      const input = document.createElement('input');
      input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
      input.addEventListener('change', () => update(Number(input.value)));
      section.append(input, node('div', 'markflow-value', format(value)));
      return section;
    }

    private strokeStyleProperty(
      section: HTMLElement, bridge: MeasurementStyleBridge, value: number, update: (value: unknown) => void
    ): HTMLElement {
      section.append(node('label', '', this.t(bridge, 'annotation.borderStyle', 'Estilo da borda')));
      const select = document.createElement('select');
      for (const [optionValue, label] of [
        [PdfAnnotationBorderStyle.SOLID, 'Sólida'],
        [PdfAnnotationBorderStyle.DASHED, 'Tracejada']
      ] as const) {
        const option = document.createElement('option');
        option.value = String(optionValue); option.textContent = label; option.selected = optionValue === value; select.append(option);
      }
      select.addEventListener('change', () => update(Number(select.value)));
      section.append(select);
      return section;
    }

    private lineEndingsProperty(
      section: HTMLElement, bridge: MeasurementStyleBridge, snapshot: MeasurementStyleSnapshot,
      update: (value: unknown) => void
    ): HTMLElement {
      section.append(node('label', '', this.t(bridge, 'annotation.lineEndings', 'Extremidades')));
      const wrapper = node('div', 'markflow-endings');
      const endings = snapshot.values.lineEndings ?? {start: PdfAnnotationLineEnding.None, end: PdfAnnotationLineEnding.None};
      const makeSelect = (side: 'start' | 'end') => {
        const select = document.createElement('select');
        for (const [optionValue, label] of [
          [PdfAnnotationLineEnding.None, 'Nenhuma'], [PdfAnnotationLineEnding.OpenArrow, 'Seta aberta'],
          [PdfAnnotationLineEnding.ClosedArrow, 'Seta fechada'], [PdfAnnotationLineEnding.Circle, 'Círculo'],
          [PdfAnnotationLineEnding.Square, 'Quadrado'], [PdfAnnotationLineEnding.Diamond, 'Losango'],
          [PdfAnnotationLineEnding.Butt, 'Traço'], [PdfAnnotationLineEnding.Slash, 'Barra']
        ] as const) {
          const option = document.createElement('option');
          option.value = String(optionValue); option.textContent = label; option.selected = optionValue === endings[side]; select.append(option);
        }
        select.ariaLabel = side === 'start' ? 'Início' : 'Fim';
        select.addEventListener('change', () => update({...endings, [side]: Number(select.value)}));
        return select;
      };
      wrapper.append(makeSelect('start'), makeSelect('end'));
      section.append(wrapper);
      return section;
    }

    private rotationProperty(
      section: HTMLElement, bridge: MeasurementStyleBridge, value: number, update: (value: unknown) => void
    ): HTMLElement {
      section.append(node('label', '', this.t(bridge, 'annotation.rotation', 'Rotação')));
      const wrapper = node('div', 'markflow-rotation');
      const left = node('button', '', '↶') as HTMLButtonElement;
      const right = node('button', '', '↷') as HTMLButtonElement;
      const input = document.createElement('input');
      left.type = right.type = 'button'; input.type = 'number'; input.value = String(value); input.min = '0'; input.max = '359';
      left.addEventListener('click', () => update((value + 270) % 360));
      right.addEventListener('click', () => update((value + 90) % 360));
      input.addEventListener('change', () => update(((Number(input.value) % 360) + 360) % 360));
      wrapper.append(left, input, right); section.append(wrapper);
      return section;
    }

    private t(bridge: MeasurementStyleBridge, key: string, fallback: string): string {
      return bridge.translate(this.currentDocumentId, key, fallback);
    }
  }

  customElements.define(ELEMENT_NAME, MeasurementStyleElement);
}

function node(tag: string, className = '', text?: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
