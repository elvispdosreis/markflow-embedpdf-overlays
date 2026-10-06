import {h, render} from 'preact';
import {MeasurementSidebar} from './features/measurement/measurement-sidebar';
import {MeasurementStyleSidebar} from './features/measurement/measurement-style-sidebar';
import {TechnicalCommentSidebar} from './features/technical-comments/technical-comment-sidebar';
export type PanelKind = 'measurement-sidebar' | 'measurement-style' | 'technical-comment-sidebar';
const panels = {'measurement-sidebar': MeasurementSidebar, 'measurement-style': MeasurementStyleSidebar, 'technical-comment-sidebar': TechnicalCommentSidebar};
export function mountPanel(kind: PanelKind, host: HTMLElement, documentId: string): () => void {
  render(h(panels[kind], {documentId}), host);
  let disposed = false;
  return () => {if (!disposed) {disposed = true; render(null, host);}};
}
export function mountMeasurementSidebar(host: HTMLElement, documentId: string): () => void {return mountPanel('measurement-sidebar', host, documentId);}
export function mountMeasurementStyle(host: HTMLElement, documentId: string): () => void {return mountPanel('measurement-style', host, documentId);}
export function mountTechnicalCommentSidebar(host: HTMLElement, documentId: string): () => void {return mountPanel('technical-comment-sidebar', host, documentId);}
