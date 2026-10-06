import {describe, expect, it, vi} from 'vitest';
import type {MeasurementSidebarItem} from './measurement-sidebar.models';
import {adjacentMeasurement, measurementKindGlyph, MeasurementSidebar, navigateToMeasurement} from './measurement-sidebar';
import {notifyMeasurementSidebar, registerMeasurementSidebarBridge} from './measurement-sidebar-bridge';

const item = (id: string, pageIndex: number): MeasurementSidebarItem => ({
  id,
  pageIndex,
  kind: 'distance',
  formattedValue: '1,00 m',
  detailRows: [],
  strokeColor: '#ef4444',
  strokeWidth: 1,
  calibration: {linearFactor: 1, unit: 'm', precision: 2},
  rect: {origin: {x: 20, y: 30}, size: {width: 40, height: 20}}
});

describe('native measurement sidebar navigation', () => {
  it('centers the page and selects the measurement annotation', () => {
    const annotation = {selectAnnotation: vi.fn()};
    const scroll = {scrollToPage: vi.fn()};

    navigateToMeasurement(item('a', 2), annotation, scroll);

    expect(scroll.scrollToPage).toHaveBeenCalledWith({
      pageNumber: 3,
      pageCoordinates: {x: 40, y: 40},
      behavior: 'smooth',
      alignX: 50,
      alignY: 50
    });
    expect(annotation.selectAnnotation).toHaveBeenCalledWith(2, 'a');
  });

  it('keeps previous and next navigation within the ordered list', () => {
    const items = [item('a', 0), item('b', 0), item('c', 1)];

    expect(adjacentMeasurement(items, 'b', -1)?.id).toBe('a');
    expect(adjacentMeasurement(items, 'b', 1)?.id).toBe('c');
    expect(adjacentMeasurement(items, 'a', -1)).toBeNull();
    expect(adjacentMeasurement(items, 'c', 1)).toBeNull();
  });

  it('gives every measurement kind a compact visual marker', () => {
    expect(new Set([
      measurementKindGlyph('distance'), measurementKindGlyph('perimeter'), measurementKindGlyph('area'),
      measurementKindGlyph('rectangle-area'), measurementKindGlyph('ellipse'), measurementKindGlyph('arc')
    ]).size).toBe(6);
  });

  it('preserves scrolling and the active editor when measurement data updates inside a shadow root', () => {
    const measurement = item('a', 0);
    const dispose = registerMeasurementSidebarBridge({
      fallbackCalibration: () => measurement.calibration,
      snapshot: () => ({items: [measurement], selectedId: measurement.id}),
      navigate: vi.fn(),
      translate: (_documentId, _key, fallback) => fallback,
      setPrecision: vi.fn()
    });
    MeasurementSidebar({documentId: 'doc'});
    const host = document.createElement('div');
    const root = host.attachShadow({mode: 'closed'});
    const view = Object.assign(document.createElement('markflow-measurements-sidebar-view'), {documentId: 'doc'});
    document.body.append(host);
    root.append(view);
    try {
      view.querySelector<HTMLElement>('ol')!.scrollTop = 170;
      view.querySelector('select')!.focus();

      notifyMeasurementSidebar();

      expect(view.querySelector<HTMLElement>('ol')!.scrollTop).toBe(170);
      expect(root.activeElement).toBe(view.querySelector('select'));
    } finally {
      host.remove();
      dispose();
    }
  });

  it('selects a detail row and requests a highlight for its segment or vertex', () => {
    const measurement: MeasurementSidebarItem = {
      ...item('area', 0), kind: 'area', detailRows: [
        {labelKey: 'markflow.measurements.sidebar.vertices', value: '4'},
        {labelKey: 'markflow.measurements.sidebar.vertex', value: '1: 2,45 m', highlight: {kind: 'vertex', index: 0}}
      ]
    };
    const navigate = vi.fn();
    const highlightDetail = vi.fn();
    const deleteVertex = vi.fn();
    const dispose = registerMeasurementSidebarBridge({
      fallbackCalibration: () => measurement.calibration,
      snapshot: () => ({items: [measurement], selectedId: measurement.id}),
      navigate, highlightDetail, deleteVertex,
      translate: (_documentId, _key, fallback) => fallback
    });
    MeasurementSidebar({documentId: 'doc'});
    const view = Object.assign(document.createElement('markflow-measurements-sidebar-view'), {documentId: 'doc'});
    document.body.append(view);
    try {
      const detail = view.querySelector<HTMLElement>('.markflow-data-cell[role="button"]')!;
      detail.click();
      expect(navigate).toHaveBeenCalledWith('doc', measurement);
      expect(highlightDetail).toHaveBeenCalledWith('doc', measurement, measurement.detailRows[1]);
      expect(view.querySelector('.markflow-detail-active')?.textContent).toContain('1: 2,45 m');
      const remove = view.querySelector<HTMLButtonElement>('.markflow-detail-active .markflow-delete-detail')!;
      expect(remove.textContent).toBe('×');
      expect(remove.getAttribute('aria-label')).toBe('Excluir vértice 1');
      remove.click();
      expect(deleteVertex).toHaveBeenCalledWith('doc', measurement, 0);
      expect(highlightDetail).toHaveBeenCalledTimes(1);
    } finally {
      view.remove();
      dispose();
    }
  });

  it('shows a delete control in the selected perimeter segment cell', () => {
    const measurement: MeasurementSidebarItem = {
      ...item('perimeter', 0), kind: 'perimeter', detailRows: [
        {labelKey: 'markflow.measurements.sidebar.segments', value: '2'},
        {labelKey: 'markflow.measurements.sidebar.segment', value: '1: 2,45 m', highlight: {kind: 'segment', index: 0}},
        {labelKey: 'markflow.measurements.sidebar.segment', value: '2: 3,12 m', highlight: {kind: 'segment', index: 1}}
      ]
    };
    const deleteSegment = vi.fn();
    const dispose = registerMeasurementSidebarBridge({
      fallbackCalibration: () => measurement.calibration,
      snapshot: () => ({items: [measurement], selectedId: measurement.id}),
      navigate: vi.fn(), highlightDetail: vi.fn(), deleteSegment,
      translate: (_documentId, _key, fallback) => fallback
    });
    MeasurementSidebar({documentId: 'doc'});
    const view = Object.assign(document.createElement('markflow-measurements-sidebar-view'), {documentId: 'doc'});
    document.body.append(view);
    try {
      const detail = view.querySelectorAll<HTMLElement>('.markflow-data-cell[role="button"]')[1];
      detail.click();
      const remove = view.querySelector<HTMLButtonElement>('.markflow-detail-active .markflow-delete-detail')!;
      expect(remove.textContent).toBe('×');
      expect(remove.getAttribute('aria-label')).toBe('Excluir segmento 2');
      remove.click();
      expect(deleteSegment).toHaveBeenCalledWith('doc', measurement, 1);
    } finally {
      view.remove();
      dispose();
    }
  });

  it.each(['distance', 'perimeter', 'area', 'rectangle-area', 'ellipse', 'arc'] as const)(
    'shows a measurement delete icon in the %s card header', kind => {
      const measurement: MeasurementSidebarItem = {...item('measure-1', 0), kind};
      const deleteMeasurement = vi.fn();
      const navigate = vi.fn();
      const dispose = registerMeasurementSidebarBridge({
        fallbackCalibration: () => measurement.calibration,
        snapshot: () => ({items: [measurement], selectedId: measurement.id}),
        navigate, deleteMeasurement,
        translate: (_documentId, _key, fallback) => fallback
      });
      MeasurementSidebar({documentId: 'doc'});
      const view = Object.assign(document.createElement('markflow-measurements-sidebar-view'), {documentId: 'doc'});
      document.body.append(view);
      try {
        const remove = view.querySelector<HTMLButtonElement>('.markflow-hero .markflow-delete-measurement')!;
        expect(remove?.getAttribute('aria-label')).toBe('Excluir medição');
        expect(remove.textContent).toBe('×');
        remove.click();
        expect(deleteMeasurement).toHaveBeenCalledWith('doc', measurement);
        expect(navigate).not.toHaveBeenCalled();
      } finally {
        view.remove();
        dispose();
      }
    }
  );
});
