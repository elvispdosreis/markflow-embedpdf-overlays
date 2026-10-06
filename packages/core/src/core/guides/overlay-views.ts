import {h, render, type ComponentChildren} from 'preact';
import type {CrosshairDrawing} from '../crosshair/crosshair-controller';
import type {CrosshairStyle} from '../crosshair/crosshair-context';
import type {PageDrawing} from './guides-controller';
import type {RulerDrawing} from './rulers-controller';
import type {GuideOrientation} from './guides-state';
import {CROSSHAIR_STYLES, GUIDES_STYLES, RULERS_STYLES} from './overlay-view-styles';

const svg = (attributes: Record<string, unknown>, children?: ComponentChildren) =>
  h('svg', {preserveAspectRatio: 'none', focusable: 'false', ...attributes}, children);
const line = (attributes: Record<string, unknown>) => h('line', attributes);

/** Public renderer: only drawing data and user-action callbacks are required. */
export function renderCrosshairView(root: ShadowRoot, drawing: CrosshairDrawing | null, style: CrosshairStyle): void {
  render(h('div', {style: {width: '100%', height: '100%'}}, h('style', null, CROSSHAIR_STYLES),
    drawing && svg({viewBox: drawing.viewBox, style: {width: '100%', height: '100%'}},
      svg({'data-crosshair-viewport': true, x: drawing.left, y: drawing.top,
        width: drawing.width, height: drawing.height}, [
        line({x1: style === 'full' ? 0 : drawing.x - 25, y1: drawing.y,
          x2: style === 'full' ? drawing.width : drawing.x + 25, y2: drawing.y}),
        line({x1: drawing.x, y1: style === 'full' ? 0 : drawing.y - 25,
          x2: drawing.x, y2: style === 'full' ? drawing.height : drawing.y + 25})
      ]))), root);
}

export function renderGuidesView(root: ShadowRoot, pages: PageDrawing[], viewBox: string, selectedId: string | null): void {
  render(h('div', {style: {width: '100%', height: '100%'}}, h('style', null, GUIDES_STYLES), svg({viewBox},
    pages.flatMap(page => page.lines.flatMap(item => [
      line({key: item.guide.id + '-hit', class: 'hit-area', 'data-guide-hit-area': true, 'stroke-width': 6,
        x1: item.hitX1, y1: item.hitY1, x2: item.hitX2, y2: item.hitY2, 'vector-effect': 'non-scaling-stroke'}),
      line({key: item.guide.id, class: 'guide-line' + (selectedId === item.guide.id ? ' selected' : ''),
        'data-guide-id': item.guide.id, 'stroke-width': 1, x1: item.x1, y1: item.y1,
        x2: item.x2, y2: item.y2, 'vector-effect': 'non-scaling-stroke'})
    ])))), root);
}

export function renderRulersView(root: ShadowRoot, d: RulerDrawing | null, unit: string, locked: boolean,
  onStart: (orientation: GuideOrientation, event: PointerEvent) => void): void {
  const ticks = (horizontal: boolean) => (horizontal ? d!.topTicks : d!.leftTicks).flatMap(tick => [
    line({key: tick.position + '-tick', class: 'tick' + (tick.major ? ' major' : ''),
      'data-major': String(tick.major), 'data-ruler-value': tick.label,
      ...(horizontal ? {x1: tick.position, x2: tick.position, y1: tick.major ? 14 : 20, y2: 28}
        : {x1: tick.major ? 14 : 20, x2: 28, y1: tick.position, y2: tick.position})}),
    tick.label && h('text', {key: tick.position + '-text',
      ...(horizontal ? {x: tick.position, y: 10, 'text-anchor': 'middle'}
        : {x: 2, y: tick.position, 'dominant-baseline': 'middle'})}, tick.label)
  ]);
  const preview = d?.preview;
  render(h('div', {style: {width: '100%', height: '100%'}}, h('style', null, RULERS_STYLES), d && [
    h('div', {class: 'corner', style: {left: d.viewerLeft - 28, top: d.viewerTop - 28}, title: 'Réguas ativas'}, 'R'),
    h('div', {class: 'top-ruler' + (locked ? ' locked' : ''), 'data-ruler': 'horizontal',
      'aria-label': 'Régua horizontal: arraste para criar Guide',
      style: {left: d.viewerLeft, top: d.viewerTop - 28, width: d.width},
      onPointerDown: (event: PointerEvent) => onStart('horizontal', event)},
      svg({viewBox: '0 0 ' + d.width + ' 28'}, ticks(true)), h('span', {class: 'unit'}, unit)),
    h('div', {class: 'left-ruler' + (locked ? ' locked' : ''), 'data-ruler': 'vertical',
      'aria-label': 'Régua vertical: arraste para criar Guide',
      style: {left: d.viewerLeft - 28, top: d.viewerTop, height: d.height},
      onPointerDown: (event: PointerEvent) => onStart('vertical', event)},
      svg({viewBox: '0 0 28 ' + d.height}, ticks(false))),
    preview && [
      svg({style: {position: 'absolute', inset: 0, pointerEvents: 'none'},
        viewBox: '0 0 ' + (d.viewerLeft + d.width) + ' ' + (d.viewerTop + d.height)},
        line({class: 'preview', 'data-guide-preview': true,
          x1: preview.x1, y1: preview.y1, x2: preview.x2, y2: preview.y2})),
      h('span', {class: 'position ' + preview.orientation + (preview.removing ? ' removing' : ''),
        style: {left: preview.x, top: preview.y}}, preview.removing ? 'Solte para remover' : preview.label)
    ]
  ]), root);
}

export function clearOverlayView(root: ShadowRoot): void {render(null, root);}
