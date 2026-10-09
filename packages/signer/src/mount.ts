import {rotateRect, restoreRect, rotatedSize, validPage, signatureRectFromBottomRight,
  type BoxRect, type QuarterTurn, type SignaturePage, type SignatureInitialPosition} from './geometry';
import {SignerState, type SignerContext, type SignatureSelection} from './state';

export interface SignerOptions {
  state: SignerState;
  context: SignerContext;
  documentId: string;
  pageIndex: number;
  /** page: inside EmbedPDF Rotate, alongside RenderLayer. rotated-page: outside Rotate. */
  hostSpace?: 'page' | 'rotated-page';
  size?: {width: number; height: number};
  resizable?: boolean;
  /** Keep the box visible while allowing native viewer tools to receive input. */
  interactive?: boolean;
  /** Only the existing box receives pointer input, leaving native thumbnail navigation available. */
  boxOnly?: boolean;
  rotationControl?: boolean;
  /** Initially show the box on the first mounted page. Set false to wait for a click. */
  autoPlace?: boolean;
  /** Automatically place once per document at bottom-right PDF margins; pageIndex defaults to 0. */
  initialPosition?: SignatureInitialPosition;
  title?: string;
  description?: string;
  /** Viewer adapters may handle a captured drag across pages. Return true when handled. */
  onDrag?: (drag: SignerDrag | null) => boolean;
}
export interface SignerDrag {
  clientX: number; clientY: number; offset: {x: number; y: number}; size: BoxRect['size'];
  phase?: 'start' | 'move' | 'end';
  /** Signature angle in displayed page space. */
  rotation?: number;
}
export interface SignerMount {update(options?: SignerOptions): void; destroy(): void}
interface Gesture {
  pointerId: number; page: SignaturePage; rotation: QuarterTurn;
  signatureRotation: number;
  start: {x: number; y: number}; rect: BoxRect; resize: boolean; previous: SignatureSelection | null;
}
/** The host must cover exactly ONE PDF page and must have no border or padding. */
export function mountSigner(host: HTMLElement, initial: SignerOptions): SignerMount {
  let options = initial, destroyed = false, gesture: Gesture | null = null;
  let rotating: {pointerId: number; previous: SignatureSelection; center: {x: number; y: number};
    start: {x: number; y: number}; moved: boolean} | null = null;
  let skipRotateClick = false;
  const root = host.shadowRoot ?? host.attachShadow({mode: 'open'});
  const style = document.createElement('style');
  style.textContent = `
    :host{display:block;position:absolute;inset:0;pointer-events:none}
    .layer{position:absolute;inset:0;overflow:hidden;pointer-events:none}
    .layer.enabled{pointer-events:auto;cursor:crosshair;touch-action:none}
    .layer.box-only{pointer-events:none;cursor:default}
    .position{position:absolute;pointer-events:auto}
    .layer.passive,.layer.passive .position{pointer-events:none}
    .signer-box{position:absolute;left:50%;top:50%;box-sizing:border-box;padding:10px;
      background:white;color:#333;border:1px dashed rgb(150,150,150);box-shadow:0 0 10px rgb(255,153,0);
      text-align:center;font:10.35px/120% Arial,sans-serif;cursor:move;overflow:hidden;touch-action:none}
    .signer-box:focus-visible{outline:2px solid #1351b4;outline-offset:3px}
    .signer-box:active{box-shadow:0 5px 5px -3px #0003,0 8px 10px 1px #0002,0 3px 14px 2px #0002}
    .rotate{position:absolute;box-sizing:border-box;width:32px;height:32px;padding:0;
      border:1px solid #007acc;border-radius:50%;background:white;color:#007acc;
      font:22px/26px Arial,sans-serif;cursor:grab;touch-action:none;z-index:1}
    .rotate svg{display:block;margin:5.5px;width:19px;height:19px}
    .angle{position:absolute;background:#333;color:white;font:12px/20px Arial;padding:2px 6px;border-radius:3px;pointer-events:none;white-space:nowrap}
    .axis{position:absolute;background:#80baff;pointer-events:none}
    .axis.horizontal{height:1px;left:-40px;right:-40px;top:50%}
    .axis.vertical{width:1px;top:-40px;bottom:-40px;left:50%}
    .rotate:hover{background:#e8f0ff}
    .rotate:focus-visible{outline:2px solid #1351b4;outline-offset:2px}
    strong{display:block;font-size:11.9px;line-height:120%;margin-bottom:3px}
    .resize{position:absolute;right:0;bottom:0;width:12px;height:12px;cursor:nwse-resize;
      background:linear-gradient(135deg,transparent 45%,#8f5700 45%,#8f5700 55%,transparent 55%)}
    [hidden]{display:none!important}
  `;
  const layer = document.createElement('div'); layer.className = 'layer';
  const position = document.createElement('div'); position.className = 'position';
  const box = document.createElement('div'); box.className = 'signer-box'; box.tabIndex = 0;
  box.setAttribute('role', 'group'); box.setAttribute('aria-roledescription', 'Área de assinatura posicionável');
  const title = document.createElement('strong');
  const description = document.createElement('span'); description.id = 'markflow-signature-description';
  box.setAttribute('aria-describedby', description.id);
  const resize = document.createElement('span'); resize.className = 'resize'; resize.setAttribute('aria-hidden', 'true');
  const rotate = document.createElement('button'); rotate.className = 'rotate'; rotate.type = 'button';
  rotate.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>';
  rotate.title = 'Arraste para girar; clique para girar 22,5°'; rotate.setAttribute('aria-label', 'Girar assinatura');
  const angleLabel = document.createElement('span'); angleLabel.className = 'angle'; angleLabel.hidden = true;
  const axes = ['horizontal', 'vertical'].map(direction => {
    const axis = document.createElement('span'); axis.className = `axis ${direction}`; axis.hidden = true; return axis;
  });
  box.append(title, description); position.append(...axes, box, resize, rotate, angleLabel); layer.append(position); root.append(style, layer);
  const abort = new AbortController();
  let unsubState = () => {}, unsubContext = () => {}, unsubClose = () => {};
  const page = () => options.context.getPage(options.documentId, options.pageIndex);
  const rotation = (page: SignaturePage) => ((page.rotation + (page.viewRotation ?? 0)) % 4) as QuarterTurn;
  const ownSelection = () => {
    const value = options.state.getSelection();
    return value?.documentId === options.documentId && value.pageIndex === options.pageIndex ? value : null;
  };
  const release = () => {
    if (rotating) {
      const pointerId = rotating.pointerId; rotating = null; skipRotateClick = true;
      if (rotate.hasPointerCapture?.(pointerId)) rotate.releasePointerCapture(pointerId);
    }
    const previous = gesture; gesture = null;
    if (previous && !previous.resize) options.onDrag?.(null);
    if (previous && layer.hasPointerCapture?.(previous.pointerId)) layer.releasePointerCapture(previous.pointerId);
  };
  const draw = () => {
    if (destroyed) return;
    const currentPage = page();
    const enabled = options.state.enabled() && currentPage !== null && validPage(currentPage);
    if (!enabled || options.interactive === false || (gesture && currentPage && rotation(currentPage) !== gesture.rotation)) release();
    if (rotating && (!enabled || options.interactive === false)) {
      const pointerId = rotating.pointerId; rotating = null; skipRotateClick = true;
      if (rotate.hasPointerCapture?.(pointerId)) rotate.releasePointerCapture(pointerId);
    }
    layer.classList.toggle('enabled', enabled && options.interactive !== false);
    layer.classList.toggle('passive', options.interactive === false);
    box.tabIndex = options.interactive === false ? -1 : 0;
    rotate.disabled = options.interactive === false;
    layer.classList.toggle('box-only', options.boxOnly === true);
    if (enabled && currentPage && options.autoPlace !== false) {
      const visualSize = rotatedSize(currentPage.size, rotation(currentPage));
      const configured = options.size ?? {width: 201.99, height: 55.0882};
      if (options.initialPosition) {
        if (currentPage.index === (options.initialPosition.pageIndex ?? 0)) {
          const rect = signatureRectFromBottomRight(options.initialPosition, configured, currentPage);
          if (rect) options.state.initialize(options.documentId, currentPage, rect, (4 - currentPage.rotation) % 4);
        }
      } else if ([configured.width, configured.height].every(n => Number.isFinite(n) && n > 0)) {
        const visual = clamp({origin: {x: (visualSize.width - configured.width) / 2, y: 40}, size: configured}, visualSize);
        options.state.initialize(options.documentId, currentPage, restoreRect(visual, currentPage.size, rotation(currentPage)),
          ((4 - rotation(currentPage)) % 4) as QuarterTurn);
      }
    }
    const selection = ownSelection(); position.hidden = !enabled || !selection;
    rotate.hidden = options.rotationControl === false;
    if (!enabled || !selection || !currentPage) return;
    const turn = rotation(currentPage);
    const visual = rotateRect(selection.rect, currentPage.size, turn);
    const hostSize = options.hostSpace === 'rotated-page' ? rotatedSize(currentPage.size, turn) : currentPage.size;
    const projected = options.hostSpace === 'rotated-page' ? visual : selection.rect;
    Object.assign(position.style, {left: `${projected.origin.x / hostSize.width * 100}%`,
      top: `${projected.origin.y / hostSize.height * 100}%`, width: `${projected.size.width / hostSize.width * 100}%`,
      height: `${projected.size.height / hostSize.height * 100}%`});
    const scale = host.clientWidth / hostSize.width;
    // A fixed screen-size control follows the displayed corner and stays inside the page.
    // Project it separately so native page rotation never turns the button upside down.
    if (scale > 0) {
      const controlSize = 32 / scale, angle = ((selection.rotation ?? 0) + turn) * Math.PI / 2;
      const radius = (selection.signatureSize?.height ?? visual.size.height) / 2 + 35 / scale;
      const visualControl = clamp({origin: {
        x: visual.origin.x + visual.size.width / 2 + radius * Math.sin(angle) - controlSize / 2,
        y: visual.origin.y + visual.size.height / 2 - radius * Math.cos(angle) - controlSize / 2}, size: {width: controlSize, height: controlSize}},
        rotatedSize(currentPage.size, turn));
      const control = options.hostSpace === 'rotated-page' ? visualControl : restoreRect(visualControl, currentPage.size, turn);
      Object.assign(rotate.style, {left: `${(control.origin.x - projected.origin.x) * scale}px`,
        top: `${(control.origin.y - projected.origin.y) * scale}px`,
        transform: `rotate(${options.hostSpace === 'rotated-page' ? 0 : -turn * 90}deg)`});
      Object.assign(angleLabel.style, {left: rotate.style.left, top: `${parseFloat(rotate.style.top) - 28}px`,
        transform: rotate.style.transform});
    }
    const labelRotation = (((selection.rotation ?? 0) + turn) % 4) * 90;
    const labelSize = selection.signatureSize ?? visual.size;
    Object.assign(box.style, {width: `${labelSize.width * scale}px`, height: `${labelSize.height * scale}px`,
      padding: `${6 * scale}px`, fontSize: `${10.35 * scale}px`,
      transform: `translate(-50%,-50%) rotate(${labelRotation - (options.hostSpace === 'rotated-page' ? 0 : turn * 90)}deg)`});
    title.style.fontSize = `${11.9 * scale}px`; title.style.marginBottom = `${3 * scale}px`;
    title.textContent = options.title ?? 'Área da assinatura';
    angleLabel.textContent = `${labelRotation.toLocaleString('pt-BR')}°`;
    angleLabel.hidden = !rotating; axes.forEach(axis => {axis.hidden = !rotating;});
    description.textContent = options.description ?? 'Tome cuidado para não esconder uma informação importante do documento.';
    box.setAttribute('aria-label', `${title.textContent}, página ${currentPage.index + 1}. Use as setas para mover; Shift para mover mais rápido. Escape para remover.`);
    resize.hidden = options.resizable !== true || (selection.rotation ?? 0) % 1 !== 0;
    // Keep the grip at the displayed bottom-right corner, independently of the text orientation.
    const gripTurn = options.hostSpace === 'rotated-page' ? 0 : turn;
    Object.assign(resize.style, {left: gripTurn >= 2 ? '0' : 'auto', right: gripTurn < 2 ? '0' : 'auto',
      top: gripTurn === 1 || gripTurn === 2 ? '0' : 'auto', bottom: gripTurn === 0 || gripTurn === 3 ? '0' : 'auto',
      transform: `rotate(${-gripTurn * 90}deg)`});
  };
  const subscribe = () => {
    unsubState = options.state.subscribe(draw);
    unsubContext = options.context.subscribe(draw);
    unsubClose = options.context.onDocumentClosed?.(id => options.state.close(id)) ?? (() => {});
  };
  const point = (event: PointerEvent, currentPage: SignaturePage) => {
    const bounds = host.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const size = rotatedSize(currentPage.size, rotation(currentPage));
    return {x: (event.clientX - bounds.left) / bounds.width * size.width,
      y: (event.clientY - bounds.top) / bounds.height * size.height};
  };
  const clamp = (rect: BoxRect, size: BoxRect['size']): BoxRect => {
    const width = Math.min(rect.size.width, size.width), height = Math.min(rect.size.height, size.height);
    return {origin: {x: Math.max(0, Math.min(rect.origin.x, size.width - width)),
      y: Math.max(0, Math.min(rect.origin.y, size.height - height))}, size: {width, height}};
  };
  const consume = (event: Event) => {event.preventDefault(); event.stopPropagation();};
  const down = (event: PointerEvent) => {
    const currentPage = page();
    if (options.interactive === false || gesture || event.button !== 0 || !options.state.enabled() || !currentPage || !validPage(currentPage)) return;
    const start = point(event, currentPage); if (!start) return;
    const turn = rotation(currentPage), size = rotatedSize(currentPage.size, turn);
    const selection = ownSelection(), previous = options.state.getSelection();
    // Navigation/clicks on another page must not transfer an existing signature.
    if (previous?.documentId === options.documentId && previous.pageIndex !== options.pageIndex) return;
    const configured = options.size ?? {width: 201.99, height: 55.0882};
    if (![configured.width, configured.height].every(n => Number.isFinite(n) && n > 0)) return;
    const onBox = position.contains(event.target as Node);
    if (!onBox && previous?.documentId === options.documentId) return;
    let visual = selection ? rotateRect(selection.rect, currentPage.size, turn) : {origin: {x: 0, y: 0}, size: configured};
    if (!onBox) visual = clamp({origin: {x: start.x - visual.size.width / 2, y: start.y - visual.size.height / 2}, size: visual.size}, size);
    const signatureRotation = selection?.rotation ?? ((4 - turn) % 4) as QuarterTurn;
    options.state.select(options.documentId, currentPage, restoreRect(visual, currentPage.size, turn), signatureRotation);
    gesture = {pointerId: event.pointerId, page: currentPage, rotation: turn,
      signatureRotation: ((signatureRotation + turn) % 4) as QuarterTurn, start, rect: visual,
      resize: event.target === resize && options.resizable === true, previous};
    if (onBox && !gesture.resize) options.onDrag?.({clientX: event.clientX, clientY: event.clientY,
      offset: {x: start.x - visual.origin.x, y: start.y - visual.origin.y}, size: visual.size, phase: 'start',
      rotation: gesture.signatureRotation});
    layer.setPointerCapture?.(event.pointerId); box.focus({preventScroll: true}); consume(event);
  };
  const move = (event: PointerEvent, ending = false) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const currentPage = page();
    if (!currentPage || !options.state.enabled() || rotation(currentPage) !== gesture.rotation) {release(); return;}
    const end = point(event, currentPage); if (!end) return;
    if (!gesture.resize && options.onDrag?.({clientX: event.clientX, clientY: event.clientY,
      offset: {x: gesture.start.x - gesture.rect.origin.x, y: gesture.start.y - gesture.rect.origin.y}, size: gesture.rect.size,
      phase: ending ? 'end' : 'move', rotation: gesture.signatureRotation})) {
      consume(event); return;
    }
    const dx = end.x - gesture.start.x, dy = end.y - gesture.start.y;
    const rect = gesture.rect, size = rotatedSize(currentPage.size, gesture.rotation);
    const next = gesture.resize
      ? {origin: rect.origin, size: {width: Math.min(size.width - rect.origin.x, Math.max(40, rect.size.width + dx)),
        height: Math.min(size.height - rect.origin.y, Math.max(20, rect.size.height + dy))}}
      : clamp({origin: {x: rect.origin.x + dx, y: rect.origin.y + dy}, size: rect.size}, size);
    const canonical = restoreRect(next, currentPage.size, gesture.rotation);
    const intrinsic = gesture.resize ? ((ownSelection()?.rotation ?? 0) % 2 === 1
      ? {width: canonical.size.height, height: canonical.size.width} : canonical.size) : undefined;
    options.state.select(options.documentId, currentPage, canonical, undefined, intrinsic); consume(event);
  };
  const cancel = () => {
    const previous = gesture?.previous; release();
    if (previous) {
      const oldPage = options.context.getPage(previous.documentId, previous.pageIndex);
      if (oldPage) options.state.select(previous.documentId, oldPage, previous.rect, previous.rotation, previous.signatureSize);
      else options.state.clear();
    } else if (previous === null) options.state.clear();
  };
  rotate.addEventListener('pointerdown', event => {
    const currentPage = page(), selection = ownSelection();
    if (options.interactive === false || event.button !== 0 || !options.state.enabled() || !currentPage || !selection) return;
    const visual = rotateRect(selection.rect, currentPage.size, rotation(currentPage));
    rotating = {pointerId: event.pointerId, previous: selection, moved: false,
      start: {x: event.clientX, y: event.clientY},
      center: {x: visual.origin.x + visual.size.width / 2, y: visual.origin.y + visual.size.height / 2}};
    skipRotateClick = false;
    rotate.setPointerCapture?.(event.pointerId); rotate.focus({preventScroll: true}); consume(event); draw();
  }, {signal: abort.signal});
  rotate.addEventListener('pointermove', event => {
    if (!rotating || rotating.pointerId !== event.pointerId) return;
    if (!rotating.moved && Math.hypot(event.clientX - rotating.start.x, event.clientY - rotating.start.y) < 3) return;
    const currentPage = page(); if (!currentPage) return;
    const cursor = point(event, currentPage); if (!cursor) return;
    const degrees = Math.atan2(cursor.y - rotating.center.y, cursor.x - rotating.center.x) * 180 / Math.PI + 90 - rotation(currentPage) * 90;
    rotating.moved = true; options.state.setRotation(options.context, degrees); consume(event);
  }, {signal: abort.signal});
  const endRotation = (event: PointerEvent, cancelled = false) => {
    if (!rotating || rotating.pointerId !== event.pointerId) return;
    const previous = rotating.previous; skipRotateClick = rotating.moved || cancelled; rotating = null;
    if (rotate.hasPointerCapture?.(event.pointerId)) rotate.releasePointerCapture(event.pointerId);
    if (cancelled) {
      const oldPage = options.context.getPage(previous.documentId, previous.pageIndex);
      if (oldPage) options.state.select(previous.documentId, oldPage, previous.rect, previous.rotation, previous.signatureSize);
    }
    draw(); consume(event);
  };
  rotate.addEventListener('pointerup', event => endRotation(event), {signal: abort.signal});
  rotate.addEventListener('pointercancel', event => endRotation(event, true), {signal: abort.signal});
  rotate.addEventListener('lostpointercapture', event => endRotation(event, true), {signal: abort.signal});
  rotate.addEventListener('click', event => {
    if (options.interactive === false) return;
    release();
    if (!skipRotateClick && ownSelection()) options.state.rotate(options.context);
    skipRotateClick = false;
    consume(event);
  }, {signal: abort.signal});
  layer.addEventListener('pointerdown', down, {signal: abort.signal});
  layer.addEventListener('pointermove', event => move(event), {signal: abort.signal});
  layer.addEventListener('pointerup', event => {
    if (gesture?.pointerId !== event.pointerId) return;
    move(event, true); release(); consume(event);
  }, {signal: abort.signal});
  layer.addEventListener('pointercancel', cancel, {signal: abort.signal});
  layer.addEventListener('lostpointercapture', cancel, {signal: abort.signal});
  // Prevent the viewer from also creating annotations/selecting text after a placement.
  for (const type of ['mousedown', 'mouseup', 'click', 'dblclick']) layer.addEventListener(type, event => {
    if (options.interactive !== false && options.state.enabled() && page()) consume(event);
  }, {signal: abort.signal});
  box.addEventListener('keydown', event => {
    const currentPage = page(), selection = ownSelection();
    if (options.interactive === false || !options.state.enabled() || !currentPage || !selection) return;
    if (event.key === 'Escape' || event.key === 'Delete' || event.key === 'Backspace') {
      release(); options.state.clear(options.documentId); consume(event); return;
    }
    const directions: Record<string, [number, number]> = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    const direction = directions[event.key]; if (!direction) return;
    const turn = rotation(currentPage), visual = rotateRect(selection.rect, currentPage.size, turn), step = event.shiftKey ? 10 : 1;
    const next = clamp({...visual, origin: {x: visual.origin.x + direction[0] * step, y: visual.origin.y + direction[1] * step}}, rotatedSize(currentPage.size, turn));
    options.state.select(options.documentId, currentPage, restoreRect(next, currentPage.size, turn)); consume(event);
  }, {signal: abort.signal});
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
  observer?.observe(host); subscribe(); draw();
  return {
    update: next => {
      if (destroyed) return;
      if (next) {
        const resubscribe = next.state !== options.state || next.context !== options.context;
        if (resubscribe || next.documentId !== options.documentId || next.pageIndex !== options.pageIndex || next.hostSpace !== options.hostSpace) release();
        if (resubscribe) {unsubState(); unsubContext(); unsubClose();}
        options = next;
        if (resubscribe) subscribe();
      }
      draw();
    },
    destroy: () => {
      if (destroyed) return;
      release(); destroyed = true; abort.abort(); observer?.disconnect(); unsubState(); unsubContext(); unsubClose();
      style.remove(); layer.remove();
    }
  };
}
