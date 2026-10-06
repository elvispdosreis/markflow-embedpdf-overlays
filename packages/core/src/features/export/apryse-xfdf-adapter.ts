import {circularArcThroughPoints} from '../measurement/arc-measurement';
import type {Calibration, MeasurementKind, MeasurementUnit, Point} from '../measurement/measurement.models';

import {MARKFLOW_NAMESPACE} from './xfdf-schema';
import {normalizeLegacyXfdf} from './xfdf-legacy-compatibility';
export type XfdfSource = 'native' | 'apryse' | 'generic';

export function detectXFDFSource(document: Document): XfdfSource {
  normalizeLegacyXfdf(document);
  if (document.documentElement.getAttribute('xmlns:markflow') === MARKFLOW_NAMESPACE
    || Array.from(document.getElementsByTagName('*')).some(element => element.hasAttributeNS(MARKFLOW_NAMESPACE, 'measurement-kind'))) return 'native';
  if (document.getElementsByTagNameNS('http://www.pdftron.com/pdfinfo', 'pdf-info').length
    || Array.from(document.getElementsByTagName('*')).some(element => measurementKind(element))) return 'apryse';
  return 'generic';
}

/** A small import boundary: vendor XML becomes native CAD annotation XML. */
export function adaptApryseAnnotation(source: Element): Element {
  const element = source.cloneNode(true) as Element;
  const kind = measurementKind(element);
  const intent = element.getAttribute('IT') || element.getAttribute('it');
  if (intent) element.setAttribute('intent', intent);
  const vertices = child(element, 'vertices');
  if (vertices?.textContent) element.setAttribute('vertices', pointsText(parsePoints(vertices.textContent)));
  if (!kind) return element;
  if (kind === 'distance') {
    if (parsePoints(element.getAttribute('start')).length !== 1 || parsePoints(element.getAttribute('end')).length !== 1) {
      throw new Error('Distância Apryse sem pontos inicial e final válidos.');
    }
  }
  if ((kind === 'perimeter' || kind === 'area' || kind === 'rectangle-area')
    && parsePoints(vertices?.textContent).length < (kind === 'perimeter' ? 2 : 3)) throw new Error('Medição Apryse sem vértices suficientes.');
  const page = Number(element.getAttribute('page'));
  const rect = parsePoints(element.getAttribute('rect'));
  if (!element.hasAttribute('page') || !Number.isInteger(page) || page < 0 || rect.length !== 2) throw new Error('Página ou rect inválido na medição Apryse.');
  let result = element;
  const setMetadata = (key: string, value: string | number) => result.setAttributeNS(MARKFLOW_NAMESPACE, `markflow:${key}`, String(value));
  if (kind === 'arc') {
    const controls = parsePoints(vertices?.textContent);
    if (controls.length !== 3) throw new Error('Arco Apryse sem os três pontos de controle.');
    // Apryse orders the controls start, through, end; CAD uses start, end, through.
    const arc = circularArcThroughPoints(controls[0], controls[2], controls[1]);
    if (!arc) throw new Error('Arco Apryse com pontos coincidentes ou alinhados.');
    result = retag(element, 'polyline');
    result.setAttribute('intent', 'MarkFlowArcMeasurement');
    result.setAttribute('vertices', pointsText(arc.points));
    setMetadata('arc-p1', pointsText([arc.start]));
    setMetadata('arc-p2', pointsText([arc.end]));
    setMetadata('arc-p3', pointsText([arc.through]));
    setMetadata('arc-p3-index', arc.throughVertexIndex);
    setBounds(result, arc.points, Number(element.getAttribute('width') ?? 1));
  } else if (kind === 'rectangle-area') {
    const points = parsePoints(vertices?.textContent);
    // A rotated rectangle must retain its vertices, not become its larger bounding box.
    if (isAxisAlignedRectangle(points)) {
      result = retag(element, 'square');
      setBounds(result, points, 0);
      result.removeAttribute('vertices');
    } else {
      setMetadata('measurement-kind', 'area');
    }
  }
  setMetadata('measurement-kind', result.getAttributeNS(MARKFLOW_NAMESPACE, 'measurement-kind') || kind);
  const measure = child(element, 'measure');
  if (!measure) throw new Error('Medição Apryse sem calibração no elemento measure.');
  const squared = kind === 'area' || kind === 'rectangle-area' || kind === 'ellipse';
  const calibration = parseApryseMeasure(measure, squared);
  setMetadata('linear-factor', calibration.linearFactor);
  setMetadata('unit', calibration.unit);
  setMetadata('precision', calibration.precision);
  if (kind === 'ellipse') setMetadata('measurement-quantity', 'area');
  return result;
}

export interface ApryseMeasure extends Calibration {scale: string; distanceUnit?: string; areaUnit?: string}

export function parseApryseMeasure(measure: Element, squared: boolean): ApryseMeasure {
  const formats = (name: string) => Array.from(child(measure, name)?.children ?? []).filter(e => e.localName === 'numberformat');
  const axis = formats('axis');
  const distance = formats('distance');
  const area = formats('area');
  const values = squared ? area : distance;
  const format = values[0];
  const factor = Number(axis[0]?.getAttribute('factor'));
  const displayFactor = Number(format?.getAttribute('factor'));
  const unit = (format?.getAttribute('unit') || '').replace(/^sq\s+/, '').replace(/[²2]$/, '');
  const denominator = Number(format?.getAttribute('precision') || 100);
  const precision = Math.log10(denominator);
  if (axis.length !== 1 || values.length !== 1 || !format || (format.getAttribute('display') || 'D') !== 'D'
    || !Number.isFinite(factor) || factor <= 0 || !Number.isFinite(displayFactor) || displayFactor <= 0
    || !Number.isInteger(precision) || precision < 0 || precision > 10
    || !['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi', 'pt'].includes(unit)) {
    throw new Error('Calibração Apryse não suportada. Use uma unidade decimal: mm, cm, m, km, in, ft, yd, mi ou pt.');
  }
  return {scale: measure.getAttribute('scale') || '', linearFactor: factor * (squared ? Math.sqrt(displayFactor) : displayFactor),
    unit: unit as MeasurementUnit, precision, distanceUnit: distance[0]?.getAttribute('unit') || undefined,
    areaUnit: area[0]?.getAttribute('unit') || undefined};
}

function measurementKind(element: Element): MeasurementKind | undefined {
  const intent = element.getAttribute('IT') || element.getAttribute('it');
  const tag = element.localName.toLowerCase();
  if (tag === 'line' && intent === 'LineDimension') return 'distance';
  if (tag === 'polyline' && intent === 'PolyLineDimension') return 'perimeter';
  if (tag === 'circle' && intent === 'EllipseDimension') return 'ellipse';
  if (tag === 'ink' && intent === 'ArcDimension') return 'arc';
  if (tag === 'polygon' && intent === 'PolygonDimension') {
    const data = child(element, 'trn-custom-data')?.getAttribute('bytes');
    try {
      if (data && JSON.parse(data)['trn-behavior-type'] === 'rectangle') return 'rectangle-area';
    } catch {
      // The supplied export double-escapes caption JSON. Recover only the known
      // flat behavior field; the proprietary caption/appearance is not needed.
      if (data && /(?:^\s*\{|,)\s*"trn-behavior-type"\s*:\s*"rectangle"\s*[,}]/.test(data)) return 'rectangle-area';
    }
    return 'area';
  }
  return undefined;
}

function child(element: Element, name: string): Element | undefined {
  return Array.from(element.children).find(child => child.localName === name);
}

function retag(element: Element, name: string): Element {
  const result = element.ownerDocument.createElementNS(element.namespaceURI, name);
  for (const attr of Array.from(element.attributes)) result.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
  for (const child of Array.from(element.childNodes)) result.appendChild(child.cloneNode(true));
  return result;
}

function parsePoints(value: string | null | undefined): Point[] {
  const numbers = value?.trim().split(/[;,\s]+/).map(Number) || [];
  if (numbers.length % 2 || !numbers.every(Number.isFinite)) throw new Error('Vértices Apryse inválidos.');
  return Array.from({length: numbers.length / 2}, (_, i) => ({x: numbers[i * 2], y: numbers[i * 2 + 1]}));
}

function pointsText(points: Point[]): string {return points.map(p => `${p.x},${p.y}`).join(';');}

function setBounds(element: Element, points: Point[], padding: number): void {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  element.setAttribute('rect', [Math.min(...xs) - padding, Math.min(...ys) - padding,
    Math.max(...xs) + padding, Math.max(...ys) + padding].join(','));
}

function isAxisAlignedRectangle(points: Point[]): boolean {
  const closed = points.length === 4 ? [...points, points[0]] : points;
  return closed.length === 5 && closed[0].x === closed[4].x && closed[0].y === closed[4].y
    && closed.slice(1).every((p, i) => p.x === closed[i].x || p.y === closed[i].y)
    && new Set(closed.map(p => p.x)).size === 2 && new Set(closed.map(p => p.y)).size === 2;
}
