const SVG_NS = 'http://www.w3.org/2000/svg';

// Shape extracted from the supplied pin.svg. Its executable script was intentionally omitted.
const PIN_PATH = 'M 12 12 L 105 12 C 153 12 188 49 188 100 C 188 151 151 188 100 188 C 49 188 12 151 12 100 Z';

export function createTechnicalCommentPin(number: number, color: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('markflow-comment-pin');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', PIN_PATH);
  path.setAttribute('fill', color);
  path.setAttribute('stroke', '#ffffff');
  path.setAttribute('stroke-width', '5');
  path.setAttribute('stroke-linejoin', 'round');
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', '100');
  text.setAttribute('y', '108');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('fill', '#ffffff');
  text.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
  text.setAttribute('font-weight', '700');
  text.setAttribute('font-size', number >= 100 ? '63' : number >= 10 ? '75' : '84');
  text.textContent = String(number);
  svg.append(path, text);
  return svg;
}
