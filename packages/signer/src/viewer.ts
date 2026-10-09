import {createCrosshairContext, findViewerViewport, overlayGeometry} from '@elvisreis/markflow-core';
import type {PluginRegistry, DocumentManagerCapability} from '@embedpdf/snippet';
import type {ScrollCapability} from '@embedpdf/plugin-scroll';
import type {ViewportCapability} from '@embedpdf/plugin-viewport';
import type {FormCapability} from '@embedpdf/plugin-form';
import type {PdfWidgetAnnoObject} from '@embedpdf/models';
import type {InteractionManagerCapability} from '@embedpdf/plugin-interaction-manager';
import {createSignerContext} from './context';
import {mountSigner, type SignerDrag, type SignerMount, type SignerOptions} from './mount';
import type {SignerContext, SignatureSelection} from './state';
import {rotateRect, restoreRect, rotatedSize, signatureRectFromBottomRight, type QuarterTurn, type SignatureInitialPosition} from './geometry';

export interface SignerPageDropTarget {
  pageIndex: number;
  /** Actual thumbnail page bitmap bounds in client pixels, excluding its label/padding. */
  bounds: {left: number; top: number; width: number; height: number};
  /** Thumbnail page rotation; defaults to the page's intrinsic PDF rotation. */
  rotation?: QuarterTurn;
  clipBounds?: {left: number; top: number; width: number; height: number};
}
export interface SignerPageDropResolver {
  (point: {x: number; y: number}): number | SignerPageDropTarget | null;
  /** Enables a persistent, draggable signature on the selected page thumbnail. */
  getPageTarget?(pageIndex: number): SignerPageDropTarget | null;
}
export interface SignerViewerOptions extends Pick<SignerOptions, 'state' | 'size' | 'resizable' | 'autoPlace' | 'initialPosition' | 'title' | 'description'> {
  viewer: HTMLElement;
  registry: PluginRegistry;
  /** Resolve a sidebar drop target to a zero-based page index. */
  pageDropTarget?: SignerPageDropResolver;
}
export interface SignerViewerMount {
  context: SignerContext;
  /** Transfer the fixed display box to another page and reveal its location. */
  moveToPage(pageIndex: number, scroll?: boolean): boolean;
  /** Explicitly apply bottom-right coordinates again, even after the initial placement. */
  setPosition(position: SignatureInitialPosition): boolean;
  /** Locate an empty AcroForm signature field by its exact name and reveal its rectangle. */
  moveToSignatureField(fieldName: string): Promise<SignatureFieldPlacementResult>;
  update(options?: SignerViewerOptions): void;
  destroy(): void;
}
export type SignatureFieldPlacementResult =
  | {status: 'placed'; fieldName: string; pageIndex: number; annotationId: string}
  | {status: 'invalid-id' | 'unavailable' | 'not-found' | 'ambiguous' | 'not-signature' | 'occupied' | 'invalid-area' | 'cancelled' | 'error'};
/** Snippet integration: mount in its native viewport overlay slot, after viewer initialization. */
export function mountSignerViewer(host: HTMLElement, initial: SignerViewerOptions): SignerViewerMount {
  let options = initial;
  const base = createCrosshairContext(options.viewer, options.registry);
  const context = createSignerContext(options.registry);
  if (!base || !context || !options.viewer.shadowRoot) throw new Error('Initialize the EmbedPDF viewer before mounting Signer.');
  const root = host.shadowRoot ?? host.attachShadow({mode: 'open'});
  const style = document.createElement('style');
  style.textContent = `:host{display:block;position:absolute;inset:0;pointer-events:none}
    .viewport{position:absolute;overflow:hidden;pointer-events:none}
    .thumbnail-preview{position:absolute;overflow:hidden;pointer-events:none;z-index:10;outline:2px solid #007acc;outline-offset:1px}
    .thumbnail-signature{position:absolute;box-sizing:border-box;border:1px dashed #007acc;
      background:#fff;color:#333;box-shadow:0 0 5px #ff9900;text-align:center;font-family:Arial,sans-serif;
      line-height:1.2;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
    .thumbnail-signature strong{font-weight:bold;display:block}
    [hidden]{display:none!important}`;
  const clip = document.createElement('div'); clip.className = 'viewport'; root.append(style, clip);
  const preview = document.createElement('div'); preview.className = 'thumbnail-preview'; preview.hidden = true;
  preview.setAttribute('aria-hidden', 'true');
  const previewBox = document.createElement('div'); previewBox.className = 'thumbnail-signature';
  const previewTitle = document.createElement('strong'), previewDescription = document.createElement('span');
  previewBox.append(previewTitle, previewDescription); preview.append(previewBox); root.append(preview);
  const thumbnailHost = document.createElement('div'); thumbnailHost.className = 'signature-thumbnail'; thumbnailHost.hidden = true;
  Object.assign(thumbnailHost.style, {position: 'absolute', pointerEvents: 'none', zIndex: '9'}); root.append(thumbnailHost);
  let thumbnailMount: SignerMount | null = null, thumbnailIndex: number | null = null, draggingThumbnail = false;
  const thumbnailContext: SignerContext = {...context,
    getPage: (id, index) => {const page = context.getPage(id, index); return page ? {...page, viewRotation: 0} : null;}};
  let destroyed = false, frame: number | undefined, lastDocumentId: string | null = null;
  let initialReveal: SignatureSelection | null = null;
  let revealFrame: number | undefined;
  let fieldPlacement = 0;
  let dragging: {index: number; value: SignerDrag; original: SignatureSelection | null} | null = null, dragFrame: number | undefined;
  const scroll = options.registry.getPlugin('scroll')?.provides?.() as ScrollCapability | undefined;
  const viewportCapability = options.registry.getPlugin('viewport')?.provides?.() as ViewportCapability | undefined;
  const documents = options.registry.getPlugin('document-manager')?.provides?.() as DocumentManagerCapability | undefined;
  const interaction = options.registry.getPlugin('interaction-manager')?.provides?.() as InteractionManagerCapability | undefined;
  const canInteract = () => {
    const id = base.getDocument()?.id;
    const scope = id ? interaction?.forDocument(id) : null;
    return !scope || (['pointerMode', 'panMode'].includes(scope.getActiveMode()) && !scope.isPaused());
  };
  const signatureOnly = () => {
    const id = base.getDocument()?.id;
    return Boolean(id && interaction?.forDocument(id).getActiveMode() === 'panMode');
  };
  const turn = (page: {rotation: QuarterTurn; viewRotation?: QuarterTurn}) => ((page.rotation + (page.viewRotation ?? 0)) % 4) as QuarterTurn;
  const fit = (origin: {x: number; y: number}, size: {width: number; height: number}, bounds: {width: number; height: number}) => {
    const fitted = {width: Math.min(size.width, bounds.width), height: Math.min(size.height, bounds.height)};
    return {origin: {x: Math.max(0, Math.min(origin.x, bounds.width - fitted.width)),
      y: Math.max(0, Math.min(origin.y, bounds.height - fitted.height))}, size: fitted};
  };
  const moveToPage = (pageIndex: number, reveal = true): boolean => {
    if (destroyed) return false;
    const active = base.getDocument(), selection = options.state.getSelection();
    if (!active || !selection || !options.state.enabled() || selection.documentId !== active.id) return false;
    const source = context.getPage(active.id, selection.pageIndex), target = context.getPage(active.id, pageIndex);
    if (!source || !target) return false;
    const visual = rotateRect(selection.rect, source.size, turn(source));
    const bounds = rotatedSize(target.size, turn(target));
    const targetSize = rotatedSize(selection.rect.size, turn(target));
    if (targetSize.width > bounds.width || targetSize.height > bounds.height) return false;
    const placed = fit(visual.origin, targetSize, bounds);
    const canonical = restoreRect(placed, target.size, turn(target));
    if (!options.state.select(active.id, target, canonical, selection.rotation, selection.signatureSize)) return false;
    if (reveal) scroll?.forDocument(active.id).scrollToPage({pageNumber: pageIndex + 1,
      pageCoordinates: {x: canonical.origin.x + canonical.size.width / 2, y: canonical.origin.y + canonical.size.height / 2},
      alignX: 50, alignY: 50, behavior: 'instant'});
    schedule(); return true;
  };
  const setPosition = (position: SignatureInitialPosition): boolean => {
    const active = base.getDocument(), index = position.pageIndex ?? 0;
    if (destroyed || !active || !options.state.enabled() || !Number.isInteger(index) || index < 0) return false;
    const page = context.getPage(active.id, index);
    const rect = page ? signatureRectFromBottomRight(position, options.size ?? {width: 201.99, height: 55.0882}, page) : null;
    if (!page || !rect) return false;
    const angle = (4 - page.rotation) % 4;
    const dimensions = options.size ?? {width: 201.99, height: 55.0882};
    if (!options.state.select(active.id, page, rect, angle, dimensions)) return false;
    initialReveal = options.state.getSelection(); schedule(); return true;
  };
  const moveToSignatureField = async (fieldName: string): Promise<SignatureFieldPlacementResult> => {
    const name = fieldName.trim(), active = base.getDocument(), request = ++fieldPlacement;
    if (!name) return {status: 'invalid-id'};
    const form = options.registry.getPlugin('form')?.provides?.() as FormCapability | undefined;
    if (destroyed || !active || !options.state.enabled() || !form) return {status: 'unavailable'};
    const state = options.state;
    let changed = false;
    const unsubscribe = state.subscribe(() => {changed = true;});
    const current = () => !destroyed && request === fieldPlacement && options.state === state && state.enabled()
      && base.getDocument()?.id === active.id && !changed;
    try {
      const matches: {pageIndex: number; widget: PdfWidgetAnnoObject}[] = [];
      for (const page of active.pages) {
        const widgets = await form.forDocument(active.id).getPageFormAnnoWidgets(page.index).toPromise();
        if (!current()) return {status: 'cancelled'};
        for (const widget of widgets) if (widget.field.name === name) matches.push({pageIndex: page.index, widget});
      }
      if (!matches.length) return {status: 'not-found'};
      if (matches.length > 1) return {status: 'ambiguous'};
      const {widget, pageIndex} = matches[0], page = context.getPage(active.id, pageIndex);
      // PDF_FORM_FIELD_TYPE.SIGNATURE = 7, using the public model's discriminant.
      if (widget.field.type !== 7) return {status: 'not-signature'};
      if (widget.field.value || (widget.field.flag & 1)) return {status: 'occupied'};
      const rect = widget.rect;
      if (!page || !state.select(active.id, page, rect, 0, rect.size, {name, annotationId: widget.id})) return {status: 'invalid-area'};
      initialReveal = state.getSelection(); schedule();
      return {status: 'placed', fieldName: name, pageIndex, annotationId: widget.id};
    } catch {return {status: current() ? 'error' : 'cancelled'};}
    finally {unsubscribe();}
  };
  const stopDrag = () => {preview.hidden = true; dragging = null; draggingThumbnail = false;
    if (dragFrame !== undefined) cancelAnimationFrame(dragFrame); dragFrame = undefined;};
  const thumbnailPlacement = (drop: SignerPageDropTarget, value: SignerDrag) => {
    const active = base.getDocument(), original = dragging?.original;
    if (!active || !original || !original.signatureSize || original.documentId !== active.id) return null;
    const page = context.getPage(active.id, drop.pageIndex), {bounds} = drop;
    if (!page || ![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)
      || bounds.width <= 0 || bounds.height <= 0) return null;
    const thumbnailTurn = drop.rotation ?? page.rotation;
    const pageSize = rotatedSize(page.size, thumbnailTurn), angle = ((original.rotation ?? 0) + thumbnailTurn) % 4;
    const radians = angle * Math.PI / 2;
    const clean = (value: number) => Math.abs(value) < 1e-12 ? 0 : Math.abs(value);
    const c = clean(Math.cos(radians)), s = clean(Math.sin(radians));
    const size = {width: original.signatureSize.width * c + original.signatureSize.height * s,
      height: original.signatureSize.width * s + original.signatureSize.height * c};
    if (size.width > pageSize.width || size.height > pageSize.height) return null;
    // Keep the original grab point in normalized bounds; the preview and committed position share this calculation.
    const anchor = {x: Math.max(0, Math.min(1, value.offset.x / value.size.width)),
      y: Math.max(0, Math.min(1, value.offset.y / value.size.height))};
    const placed = fit({x: (value.clientX - bounds.left) / bounds.width * pageSize.width - size.width * anchor.x,
      y: (value.clientY - bounds.top) / bounds.height * pageSize.height - size.height * anchor.y}, size, pageSize);
    return {active, original, page, pageSize, angle, placed, canonical: restoreRect(placed, page.size, thumbnailTurn)};
  };
  const showThumbnailPreview = (drop: SignerPageDropTarget, placement: NonNullable<ReturnType<typeof thumbnailPlacement>>) => {
    const own = host.getBoundingClientRect(), sx = own.width / host.clientWidth, sy = own.height / host.clientHeight;
    if (!(sx > 0 && sy > 0)) {preview.hidden = true; return;}
    const {bounds} = drop, {placed, pageSize, original, angle} = placement;
    const px = bounds.width / pageSize.width / sx, py = bounds.height / pageSize.height / sy;
    preview.hidden = false; preview.dataset.pageIndex = String(drop.pageIndex);
    Object.assign(preview.style, {left: `${(bounds.left - own.left) / sx}px`, top: `${(bounds.top - own.top) / sy}px`,
      width: `${bounds.width / sx}px`, height: `${bounds.height / sy}px`});
    Object.assign(previewBox.style, {
      left: `${(placed.origin.x + placed.size.width / 2) * px}px`,
      top: `${(placed.origin.y + placed.size.height / 2) * py}px`,
      width: `${original.signatureSize!.width * px}px`, height: `${original.signatureSize!.height * py}px`,
      padding: `${6 * px}px`, fontSize: `${10.35 * px}px`,
      transform: `translate(-50%,-50%) rotate(${angle * 90}deg)`});
    previewTitle.style.fontSize = `${11.9 * px}px`;
    previewTitle.textContent = options.title ?? 'Área da assinatura';
    previewDescription.textContent = options.description ?? 'Tome cuidado para não esconder uma informação importante do documento.';
  };
  const placeDrag = () => {
    const active = base.getDocument(), value = dragging?.value;
    if (!active || !value) return;
    const dropPage = options.pageDropTarget?.({x: value.clientX, y: value.clientY});
    preview.hidden = true;
    if (dropPage !== undefined && dropPage !== null) {
      if (typeof dropPage === 'number') {
        if (value.phase === 'end' && options.state.getSelection()?.pageIndex !== dropPage) moveToPage(dropPage);
      } else {
        const placement = thumbnailPlacement(dropPage, value);
        if (placement) {
          showThumbnailPreview(dropPage, placement);
          if (value.phase === 'end') {
            const {active, page, canonical, original} = placement;
            if (options.state.select(active.id, page, canonical, original.rotation, original.signatureSize)) {
              scroll?.forDocument(active.id).scrollToPage({pageNumber: page.index + 1,
                pageCoordinates: {x: canonical.origin.x + canonical.size.width / 2, y: canonical.origin.y + canonical.size.height / 2},
                alignX: 50, alignY: 50, behavior: 'instant'});
              schedule();
            }
          }
        }
      }
      return;
    }
    const viewport = findViewerViewport(options.viewer.shadowRoot!);
    const geometry = viewport ? overlayGeometry(base, viewport) : null;
    if (!geometry || value.clientX < geometry.innerLeft || value.clientX > geometry.right
      || value.clientY < geometry.innerTop || value.clientY > geometry.bottom) return;
    for (const index of base.getLayout().pageIndexes) {
      const rect = base.getPageRect(active.id, index), page = context.getPage(active.id, index);
      if (!rect || !page) continue;
      const left = geometry.originX + rect.origin.x * geometry.sx, top = geometry.originY + rect.origin.y * geometry.sy;
      const width = rect.size.width * geometry.sx, height = rect.size.height * geometry.sy;
      if (value.clientX < left || value.clientX > left + width || value.clientY < top || value.clientY > top + height) continue;
      // Document and thumbnail drops share the same PDF angle and destination-orientation calculation.
      const placement = thumbnailPlacement({pageIndex: index, bounds: {left, top, width, height}, rotation: turn(page)}, value);
      if (!placement) continue;
      options.state.select(active.id, page, placement.canonical, placement.original.rotation, placement.original.signatureSize); break;
    }
  };
  const dragTick = () => {
    dragFrame = undefined;
    const value = dragging?.value, active = base.getDocument();
    const viewport = findViewerViewport(options.viewer.shadowRoot!);
    const geometry = viewport ? overlayGeometry(base, viewport) : null;
    if (!value || !active || !geometry || !options.state.enabled()) return;
    if (value.clientX >= geometry.innerLeft && value.clientX <= geometry.right
      && value.clientY >= geometry.innerTop && value.clientY <= geometry.bottom) {
      const delta = value.clientY < geometry.innerTop + 48 ? -12 : value.clientY > geometry.bottom - 48 ? 12 : 0;
      if (delta && viewportCapability) {
        const scope = viewportCapability.forDocument(active.id), metrics = scope.getMetrics();
        scope.scrollTo({x: metrics.scrollLeft, y: Math.max(0, metrics.scrollTop + delta), behavior: 'instant'});
        placeDrag();
      }
    }
    dragFrame = requestAnimationFrame(dragTick);
  };
  const onDrag = (index: number, value: SignerDrag | null) => {
    if (!value) {stopDrag(); schedule(); return true;}
    const original = dragging?.original ?? options.state.getSelection();
    dragging = {index, value, original}; placeDrag();
    if (dragFrame === undefined) dragFrame = requestAnimationFrame(dragTick);
    return true;
  };
  const pages = new Map<number, {host: HTMLElement; mount: SignerMount | null}>();
  const clear = () => {for (const page of pages.values()) {page.mount?.destroy(); page.host.remove();} pages.clear();};
  const renderThumbnail = () => {
    const active = base.getDocument(), selection = options.state.getSelection();
    const index = draggingThumbnail ? thumbnailIndex : selection?.pageIndex;
    const target = index !== undefined && index !== null ? options.pageDropTarget?.getPageTarget?.(index) : null;
    const own = host.getBoundingClientRect(), sx = own.width / host.clientWidth, sy = own.height / host.clientHeight;
    thumbnailHost.hidden = !active || !selection || !options.state.enabled() || !target || base.isGated() || !(sx > 0 && sy > 0);
    if (thumbnailHost.hidden || !target || !active) return;
    if (!draggingThumbnail) {
      const {bounds, clipBounds} = target;
      Object.assign(thumbnailHost.style, {left: `${(bounds.left - own.left) / sx}px`, top: `${(bounds.top - own.top) / sy}px`,
        width: `${bounds.width / sx}px`, height: `${bounds.height / sy}px`, clipPath: clipBounds
          ? `inset(${Math.max(0, clipBounds.top - bounds.top) / sy}px ${Math.max(0, bounds.left + bounds.width - clipBounds.left - clipBounds.width) / sx}px ${Math.max(0, bounds.top + bounds.height - clipBounds.top - clipBounds.height) / sy}px ${Math.max(0, clipBounds.left - bounds.left) / sx}px)` : 'none'});
    }
    const mountOptions: SignerOptions = {...options, interactive: canInteract(), context: thumbnailContext, documentId: active.id, pageIndex: target.pageIndex,
      hostSpace: 'rotated-page', autoPlace: false, boxOnly: true, resizable: false, rotationControl: false,
      onDrag: value => {
        if (value) draggingThumbnail = true;
        return onDrag(target.pageIndex, value);
      }};
    thumbnailIndex = target.pageIndex;
    thumbnailHost.dataset.pageIndex = String(target.pageIndex);
    if (!thumbnailMount) thumbnailMount = mountSigner(thumbnailHost, mountOptions);
    else thumbnailMount.update(mountOptions);
  };
  const render = () => {
    if (destroyed) return;
    const active = base.getDocument();
    if (active?.id !== lastDocumentId) {stopDrag(); clear(); thumbnailMount?.destroy(); thumbnailMount = null;
      initialReveal = null;
      if (revealFrame !== undefined) cancelAnimationFrame(revealFrame); revealFrame = undefined;
      lastDocumentId = active?.id ?? null;}
    if (active && options.initialPosition && options.autoPlace !== false && options.state.enabled()) {
      const index = options.initialPosition.pageIndex ?? 0;
      const page = Number.isInteger(index) && index >= 0 ? context.getPage(active.id, index) : null;
      const rect = page ? signatureRectFromBottomRight(options.initialPosition, options.size ?? {width: 201.99, height: 55.0882}, page) : null;
      if (page && rect) {
        const before = options.state.getSelection();
        options.state.initialize(active.id, page, rect, (4 - page.rotation) % 4);
        if (before?.documentId !== active.id && options.state.getSelection()?.documentId === active.id) {
          initialReveal = options.state.getSelection();
        }
      }
    }
    renderThumbnail();
    const viewport = findViewerViewport(options.viewer.shadowRoot!);
    const geometry = viewport ? overlayGeometry(base, viewport) : null;
    clip.hidden = !active || !geometry || base.isGated();
    if (!active || !geometry || base.isGated()) {clear(); return;}
    if (initialReveal) {
      const selection = options.state.getSelection(), metrics = viewportCapability?.forDocument(active.id).getMetrics();
      if (!selection || selection.pageIndex !== initialReveal.pageIndex
        || selection.rect.origin.x !== initialReveal.rect.origin.x || selection.rect.origin.y !== initialReveal.rect.origin.y) initialReveal = null;
      else if (metrics && metrics.clientHeight > 0 && metrics.clientWidth > 0 && revealFrame === undefined
        && documents?.getDocumentState(active.id)?.status !== 'loading') {
        // Native viewport listeners attach after the first layout; reveal on the following frame.
        revealFrame = requestAnimationFrame(() => {
          revealFrame = undefined;
          const current = options.state.getSelection();
          if (!initialReveal || !current || current.documentId !== active.id
            || current.pageIndex !== initialReveal.pageIndex || current.rect.origin.x !== initialReveal.rect.origin.x
            || current.rect.origin.y !== initialReveal.rect.origin.y) {initialReveal = null; return;}
          const {rect, pageIndex} = initialReveal; initialReveal = null;
          scroll?.forDocument(active.id).scrollToPage({pageNumber: pageIndex + 1,
            pageCoordinates: {x: rect.origin.x + rect.size.width / 2, y: rect.origin.y + rect.size.height / 2},
            alignX: 50, alignY: 50, behavior: 'instant'});
        });
      }
    }
    const own = host.getBoundingClientRect();
    const hx = own.width / host.clientWidth, hy = own.height / host.clientHeight;
    if (![hx, hy].every(value => Number.isFinite(value) && value > 0)) {clear(); return;}
    const left = Math.max(own.left, geometry.innerLeft), top = Math.max(own.top, geometry.innerTop);
    Object.assign(clip.style, {left: `${(left - own.left) / hx}px`, top: `${(top - own.top) / hy}px`,
      width: `${Math.max(0, Math.min(own.right, geometry.right) - left) / hx}px`,
      height: `${Math.max(0, Math.min(own.bottom, geometry.bottom) - top) / hy}px`});
    const visible = new Set(base.getLayout().pageIndexes);
    if (dragging) visible.add(dragging.index); // Keep the pointer-capture host alive while scrolling.
    for (const [index, page] of pages) if (!visible.has(index)) {page.mount?.destroy(); page.host.remove(); pages.delete(index);}
    for (const index of visible) {
      const rect = base.getPageRect(active.id, index);
      if (!rect) continue;
      let page = pages.get(index);
      if (!page) {
        const element = document.createElement('div'); clip.append(element);
        // Set geometry before mounting so the initial box has the correct scale.
        element.style.position = 'absolute';
        page = {host: element, mount: null};
        pages.set(index, page);
      }
      Object.assign(page.host.style, {left: `${(geometry.originX + rect.origin.x * geometry.sx - left) / hx}px`,
        top: `${(geometry.originY + rect.origin.y * geometry.sy - top) / hy}px`,
        width: `${rect.size.width * geometry.sx / hx}px`, height: `${rect.size.height * geometry.sy / hy}px`});
      const mountOptions: SignerOptions = {...options, interactive: canInteract(), boxOnly: signatureOnly(), context, documentId: active.id, pageIndex: index,
        hostSpace: 'rotated-page', onDrag: value => onDrag(index, value)};
      if (!page.mount) page.mount = mountSigner(page.host, mountOptions);
      else page.mount.update(mountOptions);
    }
  };
  const schedule = () => {if (!destroyed && frame === undefined) frame = requestAnimationFrame(() => {frame = undefined; render();});};
  const unsubscribe = base.subscribe(schedule);
  let unsubscribeState = options.state.subscribe(schedule);
  const nativeThumbnails = options.registry.getPlugin('thumbnail')?.provides?.() as {onWindow?: (listener: () => void) => () => void} | undefined;
  const unsubscribeThumbnails = nativeThumbnails?.onWindow?.(schedule);
  options.viewer.shadowRoot.addEventListener('scroll', schedule, true);
  const thumbnailObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule);
  thumbnailObserver?.observe(options.viewer.shadowRoot, {childList: true, subtree: true});
  const close = context.onDocumentClosed?.(id => options.state.close(id));
  const observer = new ResizeObserver(schedule); observer.observe(host); observer.observe(options.viewer);
  render();
  return {context, moveToPage, setPosition, moveToSignatureField,
    update: next => {
      if (destroyed) return;
      if (next) {
        if (next.viewer !== options.viewer || next.registry !== options.registry) throw new Error('Remount Signer when replacing the viewer or registry.');
        if (next.state !== options.state) {unsubscribeState(); unsubscribeState = next.state.subscribe(schedule);}
        options = next;
        for (const [index, page] of pages) page.mount?.update({...options, context, documentId: lastDocumentId!, pageIndex: index,
          hostSpace: 'rotated-page', onDrag: value => onDrag(index, value)});
      }
      render();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true; stopDrag(); if (frame !== undefined) cancelAnimationFrame(frame);
      if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
      unsubscribe(); unsubscribeState(); unsubscribeThumbnails?.(); options.viewer.shadowRoot?.removeEventListener('scroll', schedule, true);
      thumbnailObserver?.disconnect();
      close?.(); observer.disconnect(); clear(); thumbnailMount?.destroy(); thumbnailHost.remove(); style.remove(); clip.remove(); preview.remove();
    }
  };
}
