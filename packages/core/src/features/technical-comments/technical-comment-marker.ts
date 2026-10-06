import {TECHNICAL_COMMENT_TYPES, type TechnicalComment, type TechnicalCommentKind} from './technical-comment.models';
import {createTechnicalCommentPin} from './technical-comment-pin';

const MARKER_ATTRIBUTE = 'data-markflow-technical-comment-marker';
const STYLE_ID = 'markflow-technical-comment-marker-style';

const STYLES = `
  .markflow-comment-marker{position:absolute;left:0;top:0;z-index:5;width:100%;height:100%;pointer-events:none;font-family:Arial,sans-serif;white-space:nowrap}
  .markflow-comment-marker .markflow-comment-pin{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 1px 2px #0004);pointer-events:auto;cursor:pointer}
  .markflow-comment-marker .markflow-comment-label{position:absolute;left:calc(100% + var(--markflow-comment-gap, 7px));top:0;box-sizing:border-box;min-width:170px;max-width:280px;width:max-content;min-height:38px;padding:8px 11px;border:1px solid #dce2ea;border-left:3px solid var(--markflow-comment-color);border-radius:8px;background:#fff;box-shadow:0 2px 9px #0002;color:#172033;font-size:14px;line-height:19px;white-space:normal;overflow-wrap:anywhere;pointer-events:auto;cursor:pointer;transform:scale(var(--markflow-comment-zoom, 1));transform-origin:top left}
  .markflow-comment-marker .markflow-comment-editor{position:absolute;left:calc(100% + 9px);top:0;z-index:10;box-sizing:border-box;display:flex;flex-direction:column;gap:9px;width:310px;padding:13px;border:1px solid #cbd5e1;border-top:3px solid var(--markflow-comment-color);border-radius:9px;background:#fff;box-shadow:0 9px 26px #0003;color:#172033;pointer-events:auto;white-space:normal}
  .markflow-comment-marker .markflow-comment-editor[data-flip="true"]{left:auto;right:8px}
  .markflow-comment-marker .markflow-comment-editor[data-flip-vertical="true"]{top:auto;bottom:0}
  .markflow-comment-marker .markflow-comment-editor strong{font-size:13px}
  .markflow-comment-marker .markflow-comment-editor label{display:flex;flex-direction:column;gap:4px;color:#475569;font-size:11px;font-weight:600}
  .markflow-comment-marker .markflow-comment-editor select,.markflow-comment-marker .markflow-comment-editor textarea{box-sizing:border-box;width:100%;padding:7px 9px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#172033;font:13px Arial,sans-serif}
  .markflow-comment-marker .markflow-comment-editor textarea{min-height:92px;resize:vertical;line-height:1.4}
  .markflow-comment-marker .markflow-comment-editor-actions{display:flex;justify-content:flex-end;gap:7px}
  .markflow-comment-marker .markflow-comment-editor button{padding:6px 11px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;font:600 12px Arial,sans-serif;cursor:pointer}
  .markflow-comment-marker .markflow-comment-editor button[type="submit"]{border-color:#2563eb;background:#2563eb;color:#fff}
`;

export interface TechnicalCommentMarkerActions {
  onEditStart?(): void;
  onSelect?(id: string, pageIndex: number): void;
  onUpdate(id: string, patch: {kind: TechnicalCommentKind; body: string}): void;
}

/** Viewer appearance for native PDF text annotations. The exported PDF keeps the sticky-note icon and contents. */
export function mountTechnicalCommentMarkers(
  root: ShadowRoot,
  snapshot: () => {items: TechnicalComment[]; legendVisible: boolean},
  actions: TechnicalCommentMarkerActions
): {refresh(): void; destroy(): void} {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  root.append(style);
  let frame: number | undefined;
  let destroyed = false;
  let editingId: string | null = null;
  let draft: {kind: TechnicalCommentKind; body: string} | null = null;
  const closeEditor = () => {editingId = null; draft = null; refresh();};
  const editor = (item: TechnicalComment, marker: HTMLElement): HTMLFormElement => {
    const form = document.createElement('form'); form.className = 'markflow-comment-editor';
    const bounds = root.querySelector<HTMLElement>('#document-content')?.getBoundingClientRect();
    const point = marker.getBoundingClientRect();
    if ((bounds?.right ?? window.innerWidth) - point.left < 355) form.dataset['flip'] = 'true';
    if ((bounds?.bottom ?? window.innerHeight) - point.top < 285) form.dataset['flipVertical'] = 'true';
    const heading = document.createElement('strong'); heading.textContent = `Editar comentário ${item.number}`;
    const kindLabel = document.createElement('label'); kindLabel.textContent = 'Tipo';
    const kind = document.createElement('select'); kind.ariaLabel = 'Tipo do comentário';
    for (const value of ['error', 'note', 'question', 'resolved'] as const) {
      const option = document.createElement('option'); option.value = value;
      option.textContent = TECHNICAL_COMMENT_TYPES[value].label;
      kind.append(option);
    }
    kind.value = draft?.kind ?? item.kind;
    kind.addEventListener('change', () => {if (draft) draft.kind = kind.value as TechnicalCommentKind;});
    kindLabel.append(kind);
    const bodyLabel = document.createElement('label'); bodyLabel.textContent = 'Comentário';
    const body = document.createElement('textarea'); body.ariaLabel = 'Texto do comentário';
    body.value = draft?.body ?? item.body;
    body.addEventListener('input', () => {if (draft) draft.body = body.value;});
    bodyLabel.append(body);
    const buttons = document.createElement('div'); buttons.className = 'markflow-comment-editor-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', closeEditor);
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Salvar';
    buttons.append(cancel, save);
    form.append(heading, kindLabel, bodyLabel, buttons);
    form.addEventListener('submit', event => {
      event.preventDefault(); event.stopPropagation();
      const patch = {kind: kind.value as TechnicalCommentKind, body: body.value};
      editingId = null; draft = null;
      actions.onUpdate(item.id, patch);
      refresh();
    });
    form.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') {event.preventDefault(); closeEditor();}
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {event.preventDefault(); form.requestSubmit();}
    });
    return form;
  };
  const sync = () => {
    if (destroyed) return;
    const {items, legendVisible} = snapshot();
    const activeIds = new Set<string>();
    const usedHosts = new Set<HTMLElement>();
    for (const item of items) {
      if (item.rect.size.width !== 24 || item.rect.size.height !== 24) continue;
      const parent = findNativeTextHost(root, item, usedHosts);
      if (!parent) continue;
      usedHosts.add(parent);
      activeIds.add(item.id);
      for (const nativeIcon of parent.querySelectorAll<HTMLElement | SVGElement>('svg, img')) {
        if (nativeIcon.closest(`[${MARKER_ATTRIBUTE}]`)) continue;
        nativeIcon.setAttribute('data-markflow-native-comment-icon', '');
        nativeIcon.style.visibility = 'hidden';
      }
      let marker = Array.from(parent.children).find(child => child.hasAttribute(MARKER_ATTRIBUTE)) as HTMLElement | undefined;
      if (!marker) {
        marker = document.createElement('span');
        marker.className = 'markflow-comment-marker';
        marker.setAttribute(MARKER_ATTRIBUTE, '');
        marker.addEventListener('pointerdown', event => {
          event.stopPropagation();
          if ((event.target as Element).closest('.markflow-comment-editor')) return;
          const current = snapshot().items.find(candidate => candidate.id === marker?.dataset['commentId']);
          if (current) actions.onSelect?.(current.id, current.pageIndex);
        });
        marker.addEventListener('mousedown', event => event.stopPropagation());
        marker.addEventListener('click', event => event.stopPropagation());
        marker.addEventListener('dblclick', event => {
          event.preventDefault(); event.stopPropagation();
          if ((event.target as Element).closest('.markflow-comment-editor')) return;
          const current = snapshot().items.find(candidate => candidate.id === marker?.dataset['commentId']);
          if (!current) return;
          actions.onEditStart?.();
          editingId = current.id;
          draft = {kind: current.kind, body: current.body};
          sync();
          marker?.querySelector<HTMLTextAreaElement>('.markflow-comment-editor textarea')?.focus();
        });
        parent.append(marker);
      }
      marker.dataset['commentId'] = item.id;
      const layerWidth = parseFloat(parent.parentElement?.style.width ?? '');
      const zoom = Number.isFinite(layerWidth) && layerWidth > 0 ? layerWidth / item.rect.size.width : 1;
      marker.style.width = `${item.rect.size.width * zoom}px`;
      marker.style.height = `${item.rect.size.height * zoom}px`;
      marker.style.setProperty('--markflow-comment-zoom', String(zoom));
      marker.style.setProperty('--markflow-comment-gap', `${7 * zoom}px`);
      const signature = `${item.id}|${item.kind}|${item.number}|${item.body}|${legendVisible}|${editingId === item.id}`;
      if (marker.dataset['signature'] === signature) continue;
      marker.dataset['signature'] = signature;
      marker.style.setProperty('--markflow-comment-color', item.color);
      marker.replaceChildren(createTechnicalCommentPin(item.number, item.color));
      if (editingId === item.id) {
        marker.append(editor(item, marker));
      } else if (legendVisible) {
        const label = document.createElement('span');
        label.className = 'markflow-comment-label';
        label.textContent = item.body || 'Novo comentário';
        marker.append(label);
      }
    }
    for (const marker of root.querySelectorAll<HTMLElement>(`[${MARKER_ATTRIBUTE}]`)) {
      if (activeIds.has(marker.dataset['commentId'] ?? '') && usedHosts.has(marker.parentElement as HTMLElement)) continue;
      marker.remove();
    }
    for (const nativeIcon of root.querySelectorAll<HTMLElement | SVGElement>('[data-markflow-native-comment-icon]')) {
      if (nativeIcon.closest(`div:has(> [${MARKER_ATTRIBUTE}])`)) continue;
      nativeIcon.style.visibility = '';
      nativeIcon.removeAttribute('data-markflow-native-comment-icon');
    }
  };
  const refresh = () => {
    if (destroyed || frame !== undefined) return;
    frame = requestAnimationFrame(() => {frame = undefined; sync();});
  };
  const observer = new MutationObserver(records => {
    if (records.some(record => record.type !== 'attributes'
      || (record.target as Element).parentElement?.hasAttribute('data-no-interaction'))) refresh();
  });
  observer.observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style']});
  refresh();
  return {
    refresh,
    destroy: () => {
      destroyed = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      observer.disconnect();
      for (const marker of root.querySelectorAll<HTMLElement>(`[${MARKER_ATTRIBUTE}]`)) marker.remove();
      for (const nativeIcon of root.querySelectorAll<HTMLElement | SVGElement>('[data-markflow-native-comment-icon]')) {
        nativeIcon.style.visibility = '';
        nativeIcon.removeAttribute('data-markflow-native-comment-icon');
      }
      style.remove();
    }
  };
}

function findNativeTextHost(root: ShadowRoot, item: TechnicalComment, used: Set<HTMLElement>): HTMLElement | null {
  for (const wrapper of root.querySelectorAll<HTMLElement>('div[data-no-interaction]')) {
    const layer = wrapper.firstElementChild as HTMLElement | null;
    const host = layer?.firstElementChild as HTMLElement | null;
    if (!layer || !host || used.has(host)) continue;
    const x = parseFloat(layer.style.left);
    const y = parseFloat(layer.style.top);
    const px = item.rect.origin.x;
    const py = item.rect.origin.y;
    if (![x, y, px, py].every(Number.isFinite)) continue;
    const scale = Math.abs(px) > 1 ? x / px : Math.abs(py) > 1 ? y / py
      : parseFloat(layer.style.width) / item.rect.size.width;
    if (!Number.isFinite(scale) || scale <= 0) continue;
    if (Math.abs(x - px * scale) > 1 || Math.abs(y - py * scale) > 1) continue;
    const width = parseFloat(layer.style.width);
    const height = parseFloat(layer.style.height);
    if (Math.abs(width - 24 * scale) > 2 && Math.abs(width - 24) > 2) continue;
    if (Math.abs(height - 24 * scale) > 2 && Math.abs(height - 24) > 2) continue;
    return host;
  }
  return null;
}
