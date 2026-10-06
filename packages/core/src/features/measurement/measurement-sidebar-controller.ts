import type {AnnotationCapability, AnnotationScope} from '@embedpdf/plugin-annotation';
import type {ScrollCapability, ScrollScope} from '@embedpdf/plugin-scroll';
import type {Calibration} from './measurement.models';
import {measurementSidebarItems, type MeasurementSidebarItem} from './measurement-sidebar.models';
import type {MeasurementSidebarBridge, MeasurementSidebarSnapshot} from './measurement-sidebar-bridge';

/** Presentation state that can be reused by any renderer. */
export class MeasurementSidebarSelection {
  expandedId: string | null = null;
  activeDetail: string | null = null;
  private documentId = '';
  setDocument(documentId: string): void {
    if (documentId === this.documentId) return;
    this.documentId = documentId; this.expandedId = this.activeDetail = null;
  }
  synchronize(snapshot: MeasurementSidebarSnapshot): void {
    if (this.activeDetail && !this.activeDetail.startsWith(`${snapshot.selectedId}:`)) this.activeDetail = null;
    if (snapshot.selectedId) this.expandedId = snapshot.selectedId;
    if (this.expandedId && !snapshot.items.some(item => item.id === this.expandedId)) this.expandedId = null;
  }
}

export interface MeasurementSidebarControllerOptions {
  getAnnotation(): AnnotationCapability | undefined;
  getScroll(): ScrollCapability | undefined;
  getCalibration(): Calibration;
  translate(documentId: string, key: string, fallback: string): string;
  actions: Omit<MeasurementSidebarBridge, 'snapshot' | 'navigate' | 'fallbackCalibration' | 'translate'>;
}

export function createMeasurementSidebarController(options: MeasurementSidebarControllerOptions): MeasurementSidebarBridge {
  return {
    ...options.actions,
    fallbackCalibration: () => options.getCalibration(),
    translate: (documentId, key, fallback) => options.translate(documentId, key, fallback),
    snapshot: documentId => {
      const scope = options.getAnnotation()?.forDocument(documentId);
      if (!scope) return {items: [], selectedId: null};
      const items = measurementSidebarItems(scope.getAnnotations().map(item => item.object), options.getCalibration());
      return {items, selectedId: scope.getSelectedAnnotationIds().find(id => items.some(item => item.id === id)) ?? null};
    },
    navigate: (documentId, item) => {
      const annotation = options.getAnnotation()?.forDocument(documentId), scroll = options.getScroll()?.forDocument(documentId);
      if (annotation && scroll) navigateToMeasurement(item, annotation, scroll);
    }
  };
}

export function navigateToMeasurement(item: MeasurementSidebarItem,
  annotation: Pick<AnnotationScope, 'selectAnnotation'>, scroll: Pick<ScrollScope, 'scrollToPage'>): void {
  scroll.scrollToPage({pageNumber: item.pageIndex + 1, pageCoordinates: {
    x: item.rect.origin.x + item.rect.size.width / 2, y: item.rect.origin.y + item.rect.size.height / 2
  }, behavior: 'smooth', alignX: 50, alignY: 50});
  annotation.selectAnnotation(item.pageIndex, item.id);
}

export function adjacentMeasurement(items: MeasurementSidebarItem[], selectedId: string | null,
  direction: -1 | 1): MeasurementSidebarItem | null {
  const index = items.findIndex(item => item.id === selectedId);
  if (index < 0) return direction === 1 ? items[0] ?? null : null;
  return items[index + direction] ?? null;
}
