import {
  PdfAnnotationBorderStyle,
  PdfAnnotationLineEnding,
  PdfAnnotationName,
  PdfAnnotationSubtype,
  type PdfAnnotationObject,
  type PdfInkAnnoObject,
  type PdfLineAnnoObject,
  type PdfPolygonAnnoObject,
  type PdfPolylineAnnoObject,
  type PdfSupportedAnnoObject
} from '@embedpdf/snippet';
import {
  arcControlPoints,
  arcThroughVertexIndex,
  type ArcAnnotationMetadata
} from '../measurement/arc-measurement';
import {isDistanceDecoration} from '../measurement/distance-measurement';
import type {Calibration, MeasurementUnit} from '../measurement/measurement.models';
import {measurementKindFromAnnotation} from '../measurement/measurement-tools';
import {technicalCommentFromAnnotation} from '../technical-comments/technical-comment.models';
import {MEASUREMENT_FILL_PATTERNS} from '../measurement/measurement-fill';
import {adaptApryseAnnotation, detectXFDFSource, type XfdfSource} from './apryse-xfdf-adapter';
import {convertXfdfCoordinates, type XfdfDocument} from './xfdf-coordinates';
import {MARKFLOW_NAMESPACE} from './xfdf-schema';

export interface XfdfCalibration extends Calibration {
  mode?: 'preset' | 'custom';
  preset?: number;
  paperValue?: number;
  paperUnit?: MeasurementUnit;
  realValue?: number;
  realUnit?: MeasurementUnit;
}

export interface XfdfExportOptions {
  fileName?: string;
  calibration?: XfdfCalibration;
}

export interface XfdfImportResult {
  annotations: PdfAnnotationObject[];
  calibration?: XfdfCalibration;
  fileName?: string;
  source?: XfdfSource;
}

const LINE_ENDINGS: Record<PdfAnnotationLineEnding, string> = {
  [PdfAnnotationLineEnding.None]: 'None',
  [PdfAnnotationLineEnding.Square]: 'Square',
  [PdfAnnotationLineEnding.Circle]: 'Circle',
  [PdfAnnotationLineEnding.Diamond]: 'Diamond',
  [PdfAnnotationLineEnding.OpenArrow]: 'OpenArrow',
  [PdfAnnotationLineEnding.ClosedArrow]: 'ClosedArrow',
  [PdfAnnotationLineEnding.Butt]: 'Butt',
  [PdfAnnotationLineEnding.ROpenArrow]: 'ROpenArrow',
  [PdfAnnotationLineEnding.RClosedArrow]: 'RClosedArrow',
  [PdfAnnotationLineEnding.Slash]: 'Slash',
  [PdfAnnotationLineEnding.Unknown]: 'None'
};

export function createXfdf(annotations: PdfAnnotationObject[], options: XfdfExportOptions = {}): string {
  const serializedAnnotations = annotations
    .filter(annotation => !isDistanceDecoration(annotation))
    .map(serializeAnnotation)
    .filter((annotation): annotation is string => annotation !== null)
    .join('\n    ');
  const file = options.fileName
    ? `\n  <f href="${escapeXml(options.fileName)}"/>`
    : '';
  const calibration = options.calibration ? serializeCalibration(options.calibration) : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<xfdf xmlns="http://ns.adobe.com/xfdf/" xmlns:markflow="urn:markflow:xfdf:1" xml:space="preserve">${file}
  <annots>${serializedAnnotations ? `\n    ${serializedAnnotations}\n  ` : ''}</annots>${calibration}
</xfdf>\n`;
}

export function parseXfdf(source: string, options: {document?: XfdfDocument; originalAnnotations?: PdfAnnotationObject[]} = {}): XfdfImportResult {
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'xfdf') {
    throw new Error('Arquivo XFDF inválido.');
  }

  const annots = Array.from(document.getElementsByTagNameNS('*', 'annots'))[0];
  const detectedSource = detectXFDFSource(document);
  if (!annots && ['add', 'modify', 'delete'].some(name => document.getElementsByTagNameNS('*', name).length)) {
    throw new Error('Importe o XFDF completo; comandos incrementais não são suportados.');
  }
  const annotations = annots
    ? Array.from(annots.children)
        .map((element, index) => parseAnnotation(detectedSource === 'native' ? element : adaptApryseAnnotation(element), index))
        .filter((annotation): annotation is PdfAnnotationObject => annotation !== null)
        .map(annotation => {
          if (detectedSource === 'native') {
            // Older RLZ exports dropped /CL and /RD. Recover only incomplete
            // callouts with the same identity in the currently opened PDF.
            if (annotation.type === PdfAnnotationSubtype.FREETEXT && annotation.intent === 'FreeTextCallout'
              && !annotation.calloutLine?.length) {
              const original = options.originalAnnotations?.find(item => item.id === annotation.id
                && item.pageIndex === annotation.pageIndex && item.type === PdfAnnotationSubtype.FREETEXT);
              if (original?.type === PdfAnnotationSubtype.FREETEXT && original.calloutLine?.length) {
                return {...annotation, calloutLine: original.calloutLine,
                  rectangleDifferences: original.rectangleDifferences, lineEnding: original.lineEnding,
                  textAlign: original.textAlign, verticalAlign: original.verticalAlign,
                  defaultStyle: original.defaultStyle};
              }
            }
            return annotation;
          }
          if (!options.document) throw new Error('Abra o PDF correspondente antes de importar o XFDF Apryse.');
          return convertXfdfCoordinates(annotation, options.document, false);
        })
    : [];
  const calibrationElement = Array.from(document.getElementsByTagNameNS('*', 'calibration'))[0];
  const fileElement = Array.from(document.getElementsByTagNameNS('*', 'f'))[0];

  return {
    annotations,
    source: detectedSource,
    calibration: calibrationElement ? parseCalibration(calibrationElement) : undefined,
    fileName: fileElement?.getAttribute('href') || undefined
  };
}

function serializeAnnotation(annotation: PdfAnnotationObject): string | null {
  const tag = annotationTag(annotation.type);
  if (!tag) {
    return null;
  }

  const attributes = commonAttributes(annotation);
  let body = annotation.contents ? `<contents>${escapeXml(annotation.contents)}</contents>` : '';

  switch (annotation.type) {
    case PdfAnnotationSubtype.LINE: {
      const line = annotation as PdfLineAnnoObject;
      attributes.push(attribute('start', point(line.linePoints.start)));
      attributes.push(attribute('end', point(line.linePoints.end)));
      if (line.lineEndings) {
        attributes.push(attribute('head', LINE_ENDINGS[line.lineEndings.start]));
        attributes.push(attribute('tail', LINE_ENDINGS[line.lineEndings.end]));
      }
      break;
    }
    case PdfAnnotationSubtype.POLYLINE:
      attributes.push(attribute('vertices', vertices((annotation as PdfPolylineAnnoObject).vertices)));
      break;
    case PdfAnnotationSubtype.POLYGON:
      attributes.push(attribute('vertices', vertices((annotation as PdfPolygonAnnoObject).vertices)));
      break;
    case PdfAnnotationSubtype.HIGHLIGHT:
    case PdfAnnotationSubtype.UNDERLINE:
    case PdfAnnotationSubtype.SQUIGGLY:
    case PdfAnnotationSubtype.STRIKEOUT:
      attributes.push(attribute('coords', annotation.segmentRects.map(rectCoordinates).join(';')));
      break;
    case PdfAnnotationSubtype.INK:
      body += `<inklist>${(annotation as PdfInkAnnoObject).inkList
        .map(stroke => `<gesture>${vertices(stroke.points)}</gesture>`)
        .join('')}</inklist>`;
      break;
    case PdfAnnotationSubtype.FREETEXT: {
      attributes.push(attribute('font', String(annotation.fontFamily)));
      attributes.push(attribute('size', formatNumber(annotation.fontSize)));
      attributes.push(attribute('text-color', annotation.fontColor));
      attributes.push(attribute('text-align', annotation.textAlign));
      attributes.push(attribute('vertical-align', annotation.verticalAlign));
      if (annotation.rectangleDifferences) {
        const rd = annotation.rectangleDifferences;
        attributes.push(attribute('fringe', [rd.left, rd.bottom, rd.right, rd.top].map(formatNumber).join(',')));
      }
      if (annotation.calloutLine) {
        attributes.push(attribute('callout', annotation.calloutLine.map(point).join(',')));
        attributes.push(attribute('head', LINE_ENDINGS[annotation.lineEnding ?? PdfAnnotationLineEnding.None]));
      }
      if (annotation.defaultStyle) body += `<defaultstyle>${escapeXml(annotation.defaultStyle)}</defaultstyle>`;
      break;
    }
  }

  const compactAttributes = attributes.filter(Boolean).join('');
  return body ? `<${tag}${compactAttributes}>${body}</${tag}>` : `<${tag}${compactAttributes}/>`;
}

function serializeCalibration(calibration: XfdfCalibration): string {
  const attributes = [
    attribute('linear-factor', formatNumber(calibration.linearFactor)),
    attribute('unit', calibration.unit),
    attribute('precision', calibration.precision),
    attribute('mode', calibration.mode),
    attribute('preset', calibration.preset),
    attribute('paper-value', calibration.paperValue),
    attribute('paper-unit', calibration.paperUnit),
    attribute('real-value', calibration.realValue),
    attribute('real-unit', calibration.realUnit)
  ].filter(Boolean).join('');
  return `\n  <markflow:calibration${attributes}/>`;
}

function parseTextIcon(value: string | null): PdfAnnotationName {
  if (value && Object.prototype.hasOwnProperty.call(PdfAnnotationName, value)) {
    const icon = PdfAnnotationName[value as keyof typeof PdfAnnotationName];
    if (typeof icon === 'number') return icon;
  }
  return PdfAnnotationName.Comment;
}

function parseAnnotation(element: Element, index: number): PdfAnnotationObject | null {
  const rect = parseRectangle(element.getAttribute('rect'));
  const common = {
    id: element.getAttribute('name') || `xfdf-${index + 1}`,
    pageIndex: parseInteger(element.getAttribute('page'), 0),
    rect,
    author: optionalAttribute(element, 'title'),
    subject: optionalAttribute(element, 'subject'),
    intent: optionalAttribute(element, 'intent'),
    contents: childText(element, 'contents'),
    flags: splitValues(element.getAttribute('flags')),
    opacity: parseNumber(element.getAttribute('opacity'), 1),
    strokeWidth: parseNumber(element.getAttribute('width'), 1),
    strokeColor: element.getAttribute('color') || '#000000',
    color: element.getAttribute('interior-color') || 'transparent',
    rotation: parseNumber(element.getAttribute('rotation'), 0),
    ...(cadAttribute(element, 'unrotated-rect') ? {unrotatedRect: parseRectangle(cadAttribute(element, 'unrotated-rect'))} : {}),
    strokeStyle: element.getAttribute('style') === 'dash' ? PdfAnnotationBorderStyle.DASHED : PdfAnnotationBorderStyle.SOLID,
    strokeDashArray: element.getAttribute('dashes')?.split(',').map(Number).filter(Number.isFinite),
    custom: measurementCustom(element)
  };

  switch (element.localName.toLowerCase()) {
    case 'line':
      return {
        ...common,
        type: PdfAnnotationSubtype.LINE,
        linePoints: {
          start: parsePoint(element.getAttribute('start')),
          end: parsePoint(element.getAttribute('end'))
        },
        lineEndings: {
          start: parseLineEnding(element.getAttribute('head')),
          end: parseLineEnding(element.getAttribute('tail'))
        },
        strokeStyle: common.strokeStyle
      } as PdfAnnotationObject;
    case 'polyline':
      return {
        ...common,
        type: PdfAnnotationSubtype.POLYLINE,
        vertices: parseVertices(element.getAttribute('vertices')),
        strokeStyle: common.strokeStyle
      } as PdfAnnotationObject;
    case 'polygon':
      return {
        ...common,
        type: PdfAnnotationSubtype.POLYGON,
        vertices: parseVertices(element.getAttribute('vertices')),
        strokeStyle: common.strokeStyle
      } as PdfAnnotationObject;
    case 'square':
      return {...common, type: PdfAnnotationSubtype.SQUARE} as PdfAnnotationObject;
    case 'circle':
      return {...common, type: PdfAnnotationSubtype.CIRCLE} as PdfAnnotationObject;
    case 'freetext': {
      const defaultStyle = childText(element, 'defaultstyle');
      const alignment = (property: string, values: string[], fallback: number) => {
        const value = defaultStyle?.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'))?.[1].trim().toLowerCase();
        const index = value ? values.indexOf(value) : -1;
        return index < 0 ? fallback : index;
      };
      // XFDF fringe uses PDF edge order: left, bottom, right, top.
      const fringe = element.getAttribute('fringe')?.split(',').map(Number);
      const callout = element.getAttribute('callout')?.split(',').map(Number);
      return {
        ...common,
        type: PdfAnnotationSubtype.FREETEXT,
        contents: common.contents || '',
        fontFamily: parseInteger(element.getAttribute('font'), 4),
        fontSize: parseNumber(element.getAttribute('FontSize') || element.getAttribute('size'), 10),
        fontColor: element.getAttribute('TextColor') || element.getAttribute('text-color') || common.strokeColor,
        textAlign: parseInteger(element.getAttribute('text-align'), alignment('text-align', ['left', 'center', 'right'], 1)),
        verticalAlign: parseInteger(element.getAttribute('vertical-align'), alignment('text-vertical-align', ['top', 'middle', 'bottom'], 1)),
        defaultStyle,
        ...(fringe?.length === 4 && fringe.every(Number.isFinite) ? {
          rectangleDifferences: {left: fringe[0], bottom: fringe[1], right: fringe[2], top: fringe[3]}
        } : {}),
        ...(callout && (callout.length === 4 || callout.length === 6) && callout.every(Number.isFinite) ? {
          calloutLine: Array.from({length: callout.length / 2}, (_, i) => ({x: callout[i * 2], y: callout[i * 2 + 1]})),
          lineEnding: parseLineEnding(element.getAttribute('head'))
        } : {})
      } as PdfAnnotationObject;
    }
    case 'ink':
      return {
        ...common,
        type: PdfAnnotationSubtype.INK,
        inkList: Array.from(element.getElementsByTagNameNS('*', 'gesture'))
          .map(gesture => ({points: parseVertices(gesture.textContent)}))
      } as PdfAnnotationObject;
    case 'text':
      return {...common, type: PdfAnnotationSubtype.TEXT, contents: common.contents || '',
        name: parseTextIcon(element.getAttribute('icon'))} as PdfAnnotationObject;
    case 'highlight':
      return markupAnnotation(common, PdfAnnotationSubtype.HIGHLIGHT, element.getAttribute('coords'));
    case 'underline':
      return markupAnnotation(common, PdfAnnotationSubtype.UNDERLINE, element.getAttribute('coords'));
    case 'squiggly':
      return markupAnnotation(common, PdfAnnotationSubtype.SQUIGGLY, element.getAttribute('coords'));
    case 'strikeout':
      return markupAnnotation(common, PdfAnnotationSubtype.STRIKEOUT, element.getAttribute('coords'));
    case 'caret':
      return {...common, type: PdfAnnotationSubtype.CARET} as PdfAnnotationObject;
    case 'redact':
      return markupAnnotation(common, PdfAnnotationSubtype.REDACT, element.getAttribute('coords'));
    default:
      return null;
  }
}

function markupAnnotation(
  common: Record<string, unknown>,
  type: PdfAnnotationSubtype,
  coords: string | null
): PdfAnnotationObject {
  return {...common, type, segmentRects: parseCoordinateRects(coords)} as PdfAnnotationObject;
}

function parseCalibration(element: Element): XfdfCalibration | undefined {
  const unit = measurementUnit(element.getAttribute('unit'));
  const linearFactor = parseNumber(element.getAttribute('linear-factor'), Number.NaN);
  if (!unit || !Number.isFinite(linearFactor) || linearFactor <= 0) {
    return undefined;
  }

  const mode = element.getAttribute('mode');
  return {
    linearFactor,
    unit,
    precision: Math.max(0, Math.min(4, parseInteger(element.getAttribute('precision'), 2))),
    mode: mode === 'preset' || mode === 'custom' ? mode : undefined,
    preset: optionalNumber(element.getAttribute('preset')),
    paperValue: optionalNumber(element.getAttribute('paper-value')),
    paperUnit: measurementUnit(element.getAttribute('paper-unit')),
    realValue: optionalNumber(element.getAttribute('real-value')),
    realUnit: measurementUnit(element.getAttribute('real-unit'))
  };
}

function commonAttributes(annotation: PdfAnnotationObject): string[] {
  const measurementKind = measurementKindFromAnnotation(annotation);
  const technicalComment = technicalCommentFromAnnotation(annotation);
  const style = annotation as PdfAnnotationObject & {
    color?: string;
    opacity?: number;
    strokeColor?: string;
    strokeWidth?: number;
  };
  const color = style.strokeColor || style.color;
  const attributes = [
    attribute('page', annotation.pageIndex),
    attribute('rect', rectangle(annotation.rect)),
    attribute('name', annotation.id),
    attribute('title', annotation.author),
    attribute('subject', annotation.subject),
    attribute('intent', annotation.intent),
    attribute('color', color),
    attribute('opacity', style.opacity),
    attribute('width', style.strokeWidth),
    ...('strokeStyle' in annotation && annotation.strokeStyle === PdfAnnotationBorderStyle.DASHED
      ? [attribute('style', 'dash'), attribute('dashes', annotation.strokeDashArray?.join(','))] : []),
    attribute('rotation', annotation.rotation),
    attribute('markflow:unrotated-rect', annotation.unrotatedRect ? rectangle(annotation.unrotatedRect) : undefined),
    attribute('flags', annotation.flags?.join(',')),
    attribute('markflow:measurement-kind', measurementKind),
    attribute('markflow:fill-pattern', measurementKind ? annotation.custom?.['measurementFillPattern'] : undefined),
    attribute('markflow:fill-color', measurementKind ? annotation.custom?.['measurementFillColor'] : undefined),
    attribute('markflow:comment-kind', technicalComment?.kind),
    attribute('markflow:comment-number', technicalComment?.number)
  ];

  if (annotation.type === PdfAnnotationSubtype.TEXT && annotation.name !== undefined) {
    attributes.push(attribute('icon', PdfAnnotationName[annotation.name] ?? 'Comment'));
  }

  if (style.color && style.color !== 'transparent') {
    attributes.push(attribute('interior-color', style.color));
  }
  // Preserve imported per-annotation calibration in the native CAD format.
  const calibration = annotation.custom?.['measurementCalibration'] as Calibration | undefined;
  if (calibration) {
    attributes.push(attribute('markflow:linear-factor', calibration.linearFactor), attribute('markflow:unit', calibration.unit),
      attribute('markflow:precision', calibration.precision));
  }
  if (annotation.custom?.['measurementQuantity'] === 'area') attributes.push(attribute('markflow:measurement-quantity', 'area'));
  if (measurementKind === 'arc' && annotation.type === PdfAnnotationSubtype.POLYLINE) {
    const controls = arcControlPoints(annotation as PdfPolylineAnnoObject);
    if (controls) {
      attributes.push(attribute('markflow:arc-p1', point(controls.start)));
      attributes.push(attribute('markflow:arc-p2', point(controls.end)));
      attributes.push(attribute('markflow:arc-p3', point(controls.through)));
      attributes.push(attribute('markflow:arc-p3-index', arcThroughVertexIndex(annotation as PdfPolylineAnnoObject)));
    }
  }
  return attributes;
}

function annotationTag(type: PdfAnnotationSubtype): string | null {
  const tags: Partial<Record<PdfAnnotationSubtype, string>> = {
    [PdfAnnotationSubtype.TEXT]: 'text',
    [PdfAnnotationSubtype.LINK]: 'link',
    [PdfAnnotationSubtype.FREETEXT]: 'freetext',
    [PdfAnnotationSubtype.LINE]: 'line',
    [PdfAnnotationSubtype.SQUARE]: 'square',
    [PdfAnnotationSubtype.CIRCLE]: 'circle',
    [PdfAnnotationSubtype.POLYGON]: 'polygon',
    [PdfAnnotationSubtype.POLYLINE]: 'polyline',
    [PdfAnnotationSubtype.HIGHLIGHT]: 'highlight',
    [PdfAnnotationSubtype.UNDERLINE]: 'underline',
    [PdfAnnotationSubtype.SQUIGGLY]: 'squiggly',
    [PdfAnnotationSubtype.STRIKEOUT]: 'strikeout',
    [PdfAnnotationSubtype.STAMP]: 'stamp',
    [PdfAnnotationSubtype.CARET]: 'caret',
    [PdfAnnotationSubtype.INK]: 'ink',
    [PdfAnnotationSubtype.REDACT]: 'redact'
  };
  return tags[type] ?? null;
}

function attribute(name: string, value: string | number | null | undefined): string {
  return value === undefined || value === null || value === ''
    ? ''
    : ` ${name}="${escapeXml(String(value))}"`;
}

function rectangle(rect: PdfSupportedAnnoObject['rect']): string {
  const left = rect.origin.x;
  const bottom = rect.origin.y;
  return [left, bottom, left + rect.size.width, bottom + rect.size.height].map(formatNumber).join(',');
}

function rectCoordinates(rect: PdfSupportedAnnoObject['rect']): string {
  const left = rect.origin.x;
  const bottom = rect.origin.y;
  const right = left + rect.size.width;
  const top = bottom + rect.size.height;
  return [left, top, right, top, left, bottom, right, bottom].map(formatNumber).join(',');
}

function vertices(points: Array<{x: number; y: number}>): string {
  return points.map(point).join(';');
}

function point(value: {x: number; y: number}): string {
  return `${formatNumber(value.x)},${formatNumber(value.y)}`;
}

function parseRectangle(value: string | null): PdfSupportedAnnoObject['rect'] {
  const [left, bottom, right, top] = numberList(value, 4);
  return {
    origin: {x: Math.min(left, right), y: Math.min(bottom, top)},
    size: {width: Math.abs(right - left), height: Math.abs(top - bottom)}
  };
}

function parsePoint(value: string | null): {x: number; y: number} {
  const [x, y] = numberList(value, 2);
  return {x, y};
}

function parseVertices(value: string | null): Array<{x: number; y: number}> {
  if (!value) {
    return [];
  }
  const groups = value.includes(';') ? value.split(';') : value.trim().split(/\s+/);
  return groups
    .map(group => group.split(',').map(Number))
    .filter(coordinates => coordinates.length >= 2 && coordinates.every(Number.isFinite))
    .map(([x, y]) => ({x, y}));
}

function parseCoordinateRects(value: string | null): PdfSupportedAnnoObject['rect'][] {
  if (!value) {
    return [];
  }
  return value.split(';').map(group => {
    const coordinates = group.split(',').map(Number).filter(Number.isFinite);
    const xs = coordinates.filter((_, index) => index % 2 === 0);
    const ys = coordinates.filter((_, index) => index % 2 === 1);
    const left = Math.min(...xs);
    const bottom = Math.min(...ys);
    const right = Math.max(...xs);
    const top = Math.max(...ys);
    return {origin: {x: left, y: bottom}, size: {width: right - left, height: top - bottom}};
  }).filter(rect => Number.isFinite(rect.origin.x) && Number.isFinite(rect.origin.y));
}

function numberList(value: string | null, minimumLength: number): number[] {
  const numbers = (value || '').split(',').map(Number).filter(Number.isFinite);
  return numbers.length >= minimumLength ? numbers : Array(minimumLength).fill(0);
}

function parseLineEnding(value: string | null): PdfAnnotationLineEnding {
  const entry = Object.entries(LINE_ENDINGS).find(([, name]) => name.toLowerCase() === value?.toLowerCase());
  return entry ? Number(entry[0]) as PdfAnnotationLineEnding : PdfAnnotationLineEnding.None;
}

function measurementCustom(element: Element): Record<string, unknown> {
  const calibrationUnit = measurementUnit(cadAttribute(element, 'unit'));
  const factor = optionalNumber(cadAttribute(element, 'linear-factor'));
  const metadata: Record<string, unknown> = {};
  const fillPattern = cadAttribute(element, 'fill-pattern');
  if (MEASUREMENT_FILL_PATTERNS.some(pattern => pattern.value === fillPattern)) {
    metadata['measurementFillPattern'] = fillPattern;
    const fillColor = cadAttribute(element, 'fill-color');
    if (fillColor) metadata['measurementFillColor'] = fillColor;
  }
  const commentKind = cadAttribute(element, 'comment-kind');
  const commentNumber = Number(cadAttribute(element, 'comment-number'));
  if ((commentKind === 'error' || commentKind === 'note' || commentKind === 'question')
    && Number.isSafeInteger(commentNumber) && commentNumber > 0) {
    const body = (childText(element, 'contents') ?? '')
      .replace(new RegExp(`^${commentNumber}\\s*[·•-]\\s*`), '').trim();
    metadata['technicalComment'] = {
      kind: commentKind,
      number: commentNumber,
      body: body === 'Novo comentário' ? '' : body
    };
  }
  if (calibrationUnit && factor && factor > 0) metadata['measurementCalibration'] = {
    linearFactor: factor, unit: calibrationUnit, precision: Math.max(0, Math.min(10, parseInteger(cadAttribute(element, 'precision'), 2)))
  } satisfies Calibration;
  if (cadAttribute(element, 'measurement-quantity') === 'area') metadata['measurementQuantity'] = 'area';
  const explicitKind = element.getAttributeNS(MARKFLOW_NAMESPACE, 'measurement-kind')
    || element.getAttribute('markflow:measurement-kind');
  const kind = explicitKind
    || (element.localName.toLowerCase() === 'line' && element.getAttribute('intent') === 'LineDimension'
      ? 'distance'
      : element.localName.toLowerCase() === 'polyline' && element.getAttribute('intent') === 'MarkFlowArcMeasurement'
        ? 'arc'
      : null);
  if (kind !== 'arc') {
    return kind ? {...metadata, measurementKind: kind} : metadata;
  }

  const start = parseOptionalPoint(cadAttribute(element, 'arc-p1'));
  const end = parseOptionalPoint(cadAttribute(element, 'arc-p2'));
  const through = parseOptionalPoint(cadAttribute(element, 'arc-p3'));
  const throughVertexIndex = optionalNumber(cadAttribute(element, 'arc-p3-index'));
  return {
    ...metadata,
    measurementKind: 'arc',
    arcGenerated: false,
    ...(start && end && through ? {
      arcControlPoints: {start, end, through},
      ...(throughVertexIndex !== undefined ? {arcThroughVertexIndex: throughVertexIndex} : {})
    } satisfies Partial<ArcAnnotationMetadata> : {})
  } satisfies ArcAnnotationMetadata;
}

function cadAttribute(element: Element, name: string): string | null {
  return element.getAttributeNS(MARKFLOW_NAMESPACE, name) || element.getAttribute(`markflow:${name}`);
}

function parseOptionalPoint(value: string | null): {x: number; y: number} | null {
  if (!value) {
    return null;
  }
  const coordinates = value.split(',').map(Number);
  return coordinates.length >= 2 && coordinates.slice(0, 2).every(Number.isFinite)
    ? {x: coordinates[0], y: coordinates[1]}
    : null;
}

function childText(element: Element, localName: string): string | undefined {
  return Array.from(element.children).find(child => child.localName === localName)?.textContent || undefined;
}

function optionalAttribute(element: Element, name: string): string | undefined {
  return element.getAttribute(name) || undefined;
}

function splitValues(value: string | null): string[] {
  return value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
}

function parseNumber(value: string | null, fallback: number): number {
  if (value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: string | null): number | undefined {
  if (value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function measurementUnit(value: string | null): MeasurementUnit | undefined {
  return ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi', 'pt'].includes(value || '') ? value as MeasurementUnit : undefined;
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
