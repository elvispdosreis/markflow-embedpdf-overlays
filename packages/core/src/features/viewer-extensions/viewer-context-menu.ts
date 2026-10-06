import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {CommandsCapability, ResolvedCommand} from '@embedpdf/plugin-commands';
import type {PanCapability} from '@embedpdf/plugin-pan';
import type {InteractionManagerCapability} from '@embedpdf/plugin-interaction-manager';
import type {UICapability, ToolbarItem, MenuItem} from '@embedpdf/plugin-ui';

export interface ViewerContextMenuOptions {
  root: ShadowRoot;
  getViewport(): HTMLElement | null;
  getActiveDocumentId(): string | null;
  annotation: AnnotationCapability;
  commands: CommandsCapability;
  pan: PanCapability;
  interaction: InteractionManagerCapability;
  ui: UICapability;
  /** Number of distinct recent tools per document; defaults to five. */
  historyLimit?: number;
  /** Host application decides when its own workflows should suppress the menu. */
  isBlocked?(): boolean;
  beforeModeChange?(): void;
}
interface RecentViewerTool {commandId: string; toolId: string; icon: SVGElement | null;}

/** Dispose before remounting and when the viewer is destroyed. */
export function mountViewerContextMenu(options: ViewerContextMenuOptions): () => void {
  const menu = new ViewerContextMenu(options);
  return () => menu.destroy();
}

class ViewerContextMenu {
  private contextMenuAbort?: AbortController;
  private viewerContextMenu?: HTMLDivElement;
  private readonly recentViewerTools = new Map<string, RecentViewerTool[]>();
  constructor(private readonly options: ViewerContextMenuOptions) {this.setupViewerContextMenu();}
  destroy(): void {
    this.contextMenuAbort?.abort();
    this.closeViewerContextMenu();
    this.recentViewerTools.clear();
  }
  private isEditingText(event: Event): boolean {
    return event.composedPath().some(target => target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      || (target instanceof HTMLElement && target.isContentEditable));
  }

  private setupViewerContextMenu(): void {
    const {root} = this.options;
    const abort = new AbortController();
    this.contextMenuAbort = abort;
    const unsubscribe = this.options.annotation?.onActiveToolChange(({documentId, tool}) => {
      const command = tool && this.options.commands?.getAllCommands(documentId).find(candidate =>
        candidate.active && candidate.visible && !candidate.disabled && candidate.categories?.includes('annotation')
        && !candidate.categories.includes('ui') && !candidate.id.startsWith('mode:'));
      // Record tool activation, not toolbar tabs, style changes or document actions.
      if (!tool || !command?.active || !command.visible || command.disabled
        || !command.categories?.includes('annotation') || command.id.startsWith('mode:')) return;
      const previous = this.recentViewerTools.get(documentId) ?? [];
      this.recentViewerTools.set(documentId, [{commandId: command.id, toolId: tool.id,
        icon: this.viewerCommandIcon(root, command.id)}, ...previous.filter(item => item.toolId !== tool.id)].slice(0, this.options.historyLimit ?? 5));
    });
    abort.signal.addEventListener('abort', () => {unsubscribe?.(); this.closeViewerContextMenu();}, {once: true});
    root.addEventListener('contextmenu', rawEvent => {
      const event = rawEvent as MouseEvent;
      const viewport = this.options.getViewport();
      if (!viewport || !event.composedPath().includes(viewport) || this.isEditingText(event)) return;
      const documentId = this.options.getActiveDocumentId();
      if (!documentId || this.options.isBlocked?.()) return;
      event.preventDefault();
      event.stopPropagation();
      this.openViewerContextMenu(root, viewport, documentId, event.clientX, event.clientY);
    }, {capture: true, signal: abort.signal});
    window.addEventListener('pointerdown', event => {
      if (!this.viewerContextMenu?.contains(event.composedPath()[0] as Node)) this.closeViewerContextMenu();
      // A right click opens shortcuts without starting a drawing or dragging a handle.
      if (event.button === 2) {
        const viewport = this.options.getViewport();
        if (viewport && event.composedPath().includes(viewport)
          && !this.isEditingText(event) && !this.options.isBlocked?.()) event.stopPropagation();
      }
    }, {capture: true, signal: abort.signal});
    window.addEventListener('keydown', event => {
      if (!this.viewerContextMenu) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); this.closeViewerContextMenu();
      } else if (event.key === 'Tab') this.closeViewerContextMenu();
    }, {capture: true, signal: abort.signal});
    root.addEventListener('scroll', () => this.closeViewerContextMenu(), {capture: true, signal: abort.signal});
    root.addEventListener('wheel', () => this.closeViewerContextMenu(), {capture: true, passive: true, signal: abort.signal});
    window.addEventListener('resize', () => this.closeViewerContextMenu(), {signal: abort.signal});
    window.addEventListener('blur', () => this.closeViewerContextMenu(), {signal: abort.signal});
  }

  private viewerCommandIcon(root: ShadowRoot, commandId: string): SVGElement | null {
    // EmbedPDF snippet DOM adapter: toolbar identifiers must match the UI schema.
    const schema = this.options.ui?.getSchema();
    const findIcon = (items: readonly (ToolbarItem | MenuItem)[]): SVGElement | null => {
      for (const item of items) {
        if ('commandId' in item && item.commandId === commandId) {
          const icon = root.querySelector<SVGElement>(`[data-epdf-i="${CSS.escape(item.id)}"] svg`);
          if (icon) return icon.cloneNode(true) as SVGElement;
        }
        if ('items' in item && Array.isArray(item.items)) {
          const icon = findIcon(item.items);
          if (icon) return icon;
        }
      }
      return null;
    };
    for (const group of [...Object.values(schema?.toolbars ?? {}), ...Object.values(schema?.menus ?? {})]) {
      const icon = findIcon(group.items);
      if (icon) return icon;
    }
    return null;
  }

  private openViewerContextMenu(root: ShadowRoot, viewport: HTMLElement, documentId: string, x: number, y: number): void {
    this.closeViewerContextMenu();
    const commands = this.options.commands;
    const pan = this.options.pan?.forDocument(documentId);
    const interaction = this.options.interaction?.forDocument(documentId);
    if (!commands || !pan || !interaction) return;
    const menu = document.createElement('div');
    menu.className = 'pdf-markflow-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Atalhos da planta');
    const style = document.createElement('style');
    style.textContent = `
      .pdf-markflow-context-menu{position:fixed;z-index:1000;display:flex;gap:2px;padding:5px;border:1px solid #d5dbe5;border-radius:6px;background:#fff;box-shadow:0 2px 6px #17203326;color:#64748b}
      .pdf-markflow-context-menu button{display:grid;place-items:center;width:36px;height:34px;padding:7px;border:1px solid transparent;border-radius:4px;background:transparent;color:inherit;cursor:pointer}
      .pdf-markflow-context-menu button:hover{background:#f1f5f9;color:#334155}
      .pdf-markflow-context-menu button[aria-checked="true"]{border-color:#bfdbfe;background:#eff6ff;color:#2563eb}
      .pdf-markflow-context-menu button:focus-visible{outline:2px solid #2563eb;outline-offset:1px}
      .pdf-markflow-context-menu svg{width:20px;height:20px;pointer-events:none}
      .pdf-markflow-context-menu .pdf-context-divider{width:1px;margin:5px 3px;background:#e2e8f0}
    `;
    menu.append(style);
    const addButton = (command: ResolvedCommand, label: string, active: boolean, icon: SVGElement | null, action: () => void) => {
      if (!command.visible || command.disabled) return;
      const button = document.createElement('button');
      button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
      button.setAttribute('role', 'menuitemradio'); button.setAttribute('aria-checked', String(active));
      button.dataset['commandId'] = command.id;
      if (icon) button.append(icon.cloneNode(true));
      else {
        // Keep a usable, labelled shortcut even when its native toolbar is unmounted.
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6');
        const path = document.createElementNS(svg.namespaceURI, 'path');
        path.setAttribute('d', command.id === 'pan:toggle'
          ? 'M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v10c0 4-2 6-6 6h-1c-2 0-3-1-4-3l-4-5a2 2 0 0 1 3-2l2 2'
          : command.id === 'pointer:toggle' ? 'M5 3l14 9-7 1-3 7z'
          : 'M4 20l4-1L20 7l-3-3L5 16z M14 7l3 3');
        svg.append(path); button.append(svg);
      }
      button.addEventListener('click', () => {
        this.closeViewerContextMenu();
        if (this.options.getActiveDocumentId() === documentId) action();
      });
      menu.append(button);
    };
    addButton(commands.resolve('pan:toggle', documentId), 'Modo Arrastar', pan.isPanMode(), this.viewerCommandIcon(root, 'pan:toggle'), () => {
      this.options.beforeModeChange?.(); this.options.annotation?.forDocument(documentId).setActiveTool(null); pan.enablePan();
    });
    addButton(commands.resolve('pointer:toggle', documentId), 'Modo Ponteiro', interaction.getActiveMode() === 'pointerMode',
      this.viewerCommandIcon(root, 'pointer:toggle'), () => {
        this.options.beforeModeChange?.(); this.options.annotation?.forDocument(documentId).setActiveTool(null); interaction.activate('pointerMode');
      });
    const recent = (this.recentViewerTools.get(documentId) ?? []).map(tool => ({tool, command: commands.resolve(tool.commandId, documentId)}))
      .filter(({command}) => command.visible && !command.disabled);
    if (recent.length) {
      const divider = document.createElement('span'); divider.className = 'pdf-context-divider'; divider.setAttribute('aria-hidden', 'true'); menu.append(divider);
    }
    for (const {tool, command} of recent) addButton(command, command.label, command.active, tool.icon, () => {
      // Native tool commands toggle. An already active recent tool stays selected.
      if (!commands.resolve(command.id, documentId).active) commands.execute(command.id, documentId, 'ui');
    });
    menu.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const buttons = Array.from(menu.querySelectorAll('button'));
      const index = buttons.indexOf(root.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    });
    root.append(menu); this.viewerContextMenu = menu;
    const bounds = viewport.getBoundingClientRect();
    const minX = Math.max(4, bounds.left + 4), minY = Math.max(4, bounds.top + 4);
    menu.style.left = `${Math.max(minX, Math.min(x + 8, Math.min(window.innerWidth, bounds.right) - menu.offsetWidth - 4))}px`;
    menu.style.top = `${Math.max(minY, Math.min(y + 8, Math.min(window.innerHeight, bounds.bottom) - menu.offsetHeight - 4))}px`;
    menu.querySelector('button')?.focus();
  }

  private closeViewerContextMenu(): void {
    this.viewerContextMenu?.remove();
    this.viewerContextMenu = undefined;
  }

}
