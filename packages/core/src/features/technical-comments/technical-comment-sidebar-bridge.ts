import type {TechnicalComment, TechnicalCommentKind} from './technical-comment.models';

export interface TechnicalCommentSidebarSnapshot {
  items: TechnicalComment[];
  selectedId: string | null;
  creationKind: TechnicalCommentKind;
  creating: boolean;
  legendVisible: boolean;
}

export interface TechnicalCommentSidebarBridge {
  snapshot(documentId: string): TechnicalCommentSidebarSnapshot;
  navigate(documentId: string, item: TechnicalComment): void;
  update(documentId: string, id: string, patch: {kind?: TechnicalCommentKind; body?: string}): void;
  remove(documentId: string, id: string): void;
  setCreationKind(documentId: string, kind: TechnicalCommentKind): void;
  setLegendVisible(documentId: string, visible: boolean): void;
  startCreating(documentId: string): void;
  translate(documentId: string, key: string, fallback: string): string;
}

let activeBridge: TechnicalCommentSidebarBridge | null = null;
const listeners = new Set<() => void>();

export function registerTechnicalCommentSidebarBridge(bridge: TechnicalCommentSidebarBridge): () => void {
  activeBridge = bridge;
  return () => { if (activeBridge === bridge) activeBridge = null; };
}

export function getTechnicalCommentSidebarBridge(): TechnicalCommentSidebarBridge | null {
  return activeBridge;
}

export function subscribeTechnicalCommentSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyTechnicalCommentSidebar(): void {
  for (const listener of listeners) listener();
}
