import {PdfAnnotationSubtype, type PdfAnnotationObject, type PdfInkAnnoObject, type Position} from '@embedpdf/snippet';
import {isShapeMeasurementAnnotation, type ShapeMeasurementAnnotation} from './shape-measurement-label';

export const MEASUREMENT_FILL_PATTERNS = [
  {value: 'solid', label: 'Sólido'},
  {value: 'diagonal', label: 'Listras diagonais'},
  {value: 'horizontal', label: 'Listras horizontais'},
  {value: 'vertical', label: 'Listras verticais'},
  {value: 'crosshatch', label: 'Cruzado'},
  {value: 'dots', label: 'Pontilhado'},
  {value: 'crosses', label: 'Cruzes rotacionadas'}
] as const;
export type MeasurementFillPattern = typeof MEASUREMENT_FILL_PATTERNS[number]['value'];
type FillSource = Partial<PdfAnnotationObject> & {color?: string; strokeColor?: string};

export function measurementFillPattern(source: FillSource): MeasurementFillPattern {
  const value = source.custom?.['measurementFillPattern'];
  return MEASUREMENT_FILL_PATTERNS.find(item => item.value === value)?.value ?? 'solid';
}

export function measurementFillColor(source: FillSource): string {
  return source.custom?.['measurementFillColor'] ?? source.color ?? 'transparent';
}

/** Keep the chosen fill color while the native shape stays hollow behind its hatch. */
export function measurementFillStylePatch(source: FillSource, property: 'fillPattern' | 'color', value: unknown): Partial<PdfAnnotationObject> {
  const pattern = property === 'fillPattern'
    ? MEASUREMENT_FILL_PATTERNS.find(item => item.value === value)?.value ?? measurementFillPattern(source)
    : measurementFillPattern(source);
  let color = property === 'color' && typeof value === 'string' ? value : measurementFillColor(source);
  if (property === 'fillPattern' && pattern !== 'solid' && measurementFillPattern(source) === 'solid' && color === 'transparent') {
    color = source.strokeColor && source.strokeColor !== 'transparent' ? source.strokeColor : '#E44234';
  }
  return {color: pattern === 'solid' ? color : 'transparent', custom: {...source.custom,
    measurementFillPattern: pattern, measurementFillColor: color}} as Partial<PdfAnnotationObject>;
}

export function measurementFillDecorationId(id: string): string {return `${id}-measurement-fill`;}

/** One native Ink annotation holds clipped hatch strokes, including on PDF export. */
export function buildMeasurementFill(annotation: ShapeMeasurementAnnotation): PdfInkAnnoObject | null {
  const pattern = measurementFillPattern(annotation);
  const color = measurementFillColor(annotation);
  if (pattern === 'solid' || color === 'transparent' || !isShapeMeasurementAnnotation(annotation)) return null;
  const bounds = annotation.unrotatedRect ?? annotation.rect;
  const {width, height} = bounds.size;
  if (width <= 0 || height <= 0) return null;
  const inset = Math.max(1, (annotation.strokeWidth ?? 1) / 2 + 0.5);
  const points = annotation.type === PdfAnnotationSubtype.POLYGON ? annotation.vertices
    : annotation.type === PdfAnnotationSubtype.CIRCLE
      ? Array.from({length: 128}, (_, i) => ({
        x: bounds.origin.x + width / 2 + Math.max(0, width / 2 - inset) * Math.cos(i * Math.PI / 64),
        y: bounds.origin.y + height / 2 + Math.max(0, height / 2 - inset) * Math.sin(i * Math.PI / 64)
      }))
      : [{x: bounds.origin.x + inset, y: bounds.origin.y + inset},
        {x: bounds.origin.x + width - inset, y: bounds.origin.y + inset},
        {x: bounds.origin.x + width - inset, y: bounds.origin.y + height - inset},
        {x: bounds.origin.x + inset, y: bounds.origin.y + height - inset}];
  if (points.length < 3 || width <= inset * 2 || height <= inset * 2) return null;
  // Bound density on unusually large CAD sheets without depending on viewer zoom.
  const spaced = pattern === 'dots' || pattern === 'crosses';
  const step = Math.max(10, Math.max(width, height) / 400, spaced ? Math.sqrt(width * height / 8000) : 0);
  const strokes: Position[][] = [];
  const angles = pattern === 'horizontal' ? [0] : pattern === 'vertical' ? [Math.PI / 2]
    : pattern === 'crosshatch' ? [-Math.PI / 4, Math.PI / 4] : [-Math.PI / 4];
  if (spaced) {
    const crossAxes = [-Math.PI / 4, Math.PI / 4].map(angle => {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      return {cos, sin, projected: points.map(p => ({x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos}))};
    });
    for (let y = bounds.origin.y + step / 2; y < bounds.origin.y + height; y += step) {
      const intervals = clipScanline(points, y);
      for (let x = bounds.origin.x + step / 2; x < bounds.origin.x + width; x += step) {
        // A short round-ended ink stroke is a dot in all native PDF readers.
        if (!intervals.some(([left, right]) => x > left + 1 && x < right - 1)) continue;
        if (pattern === 'dots') strokes.push([{x, y}, {x: x + 0.15, y}]);
        else for (const {cos, sin, projected} of crossAxes) {
          const px = x * cos + y * sin, py = -x * sin + y * cos;
          for (const [left, right] of clipScanline(projected, py)) {
            const start = Math.max(left + 0.5, px - Math.SQRT2 * 2);
            const end = Math.min(right - 0.5, px + Math.SQRT2 * 2);
            if (end <= start) continue;
            strokes.push([{x: start * cos - py * sin, y: start * sin + py * cos},
              {x: end * cos - py * sin, y: end * sin + py * cos}]);
          }
        }
      }
    }
  } else {
    for (const angle of angles) {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const projected = points.map(p => ({x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos}));
      const min = Math.min(...projected.map(p => p.y)), max = Math.max(...projected.map(p => p.y));
      for (let y = (Math.floor(min / step) + 1) * step; y < max; y += step) {
        for (const [left, right] of clipScanline(projected, y)) {
          if (right - left <= 1) continue;
          strokes.push([{x: (left + 0.5) * cos - y * sin, y: (left + 0.5) * sin + y * cos},
            {x: (right - 0.5) * cos - y * sin, y: (right - 0.5) * sin + y * cos}]);
        }
      }
    }
  }
  const angle = (annotation.rotation ?? 0) * Math.PI / 180;
  const cx = bounds.origin.x + width / 2, cy = bounds.origin.y + height / 2;
  const rotate = (p: Position): Position => ({x: cx + (p.x - cx) * Math.cos(angle) - (p.y - cy) * Math.sin(angle),
    y: cy + (p.x - cx) * Math.sin(angle) + (p.y - cy) * Math.cos(angle)});
  return strokes.length ? {
    id: measurementFillDecorationId(annotation.id), pageIndex: annotation.pageIndex, type: PdfAnnotationSubtype.INK,
    rect: annotation.rect, inkList: strokes.map(points => ({points: points.map(rotate)})),
    strokeColor: color,
    strokeWidth: 1, opacity: annotation.opacity ?? 1, color: 'transparent', strokeStyle: 1,
    flags: ['print', 'readOnly', 'locked'], contents: '',
    custom: {measurementDecorationFor: annotation.id, measurementFillDecoration: true}
  } as PdfInkAnnoObject : null;
}

// Pair intersections using the even-odd rule, so concave polygons keep their gaps.
function clipScanline(points: Position[], y: number): [number, number][] {
  const intersections: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
  }
  intersections.sort((a, b) => a - b);
  return Array.from({length: Math.floor(intersections.length / 2)}, (_, i) => [intersections[i * 2], intersections[i * 2 + 1]]);
}
