import {describe, expect, it, vi} from 'vitest';
import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/models';
import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {ScrollCapability} from '@embedpdf/plugin-scroll';
import {MeasurementStyleController} from '../measurement/measurement-style-controller';
import {createMeasurementSidebarController, MeasurementSidebarSelection} from '../measurement/measurement-sidebar-controller';
import {createTechnicalCommentSidebarController} from '../technical-comments/technical-comment-sidebar-controller';
import {decorateTechnicalComment, TECHNICAL_COMMENT_TOOL_ID} from '../technical-comments/technical-comment.models';
import type {MeasurementSidebarItem} from '../measurement/measurement-sidebar.models';

const line = {id: 'line', pageIndex: 1, type: PdfAnnotationSubtype.LINE,
  rect: {origin: {x: 10, y: 20}, size: {width: 30, height: 40}},
  linePoints: {start: {x: 10, y: 20}, end: {x: 40, y: 60}},
  strokeColor: '#123456', strokeWidth: 2, custom: {measurementKind: 'distance'}} as PdfAnnotationObject;

describe('Independent viewer panel controllers', () => {
  it('resolves selected styles and active tool defaults using fresh capability state', () => {
    let selected = [{object: line}], active = {id: 'measure-distance', defaults: {strokeWidth: 4}};
    const annotation = {forDocument: () => ({getSelectedAnnotations: () => selected, getActiveTool: () => active}),
      getColorPresets: () => ['#123456']} as unknown as AnnotationCapability;
    const translated = vi.fn((_doc: string, _key: string, fallback: string) => fallback);
    const controller = new MeasurementStyleController({getAnnotation: () => annotation, translate: translated});
    expect(controller.snapshot('doc')).toMatchObject({kind: 'distance', mode: 'selection', values: {strokeWidth: 2}});
    selected = []; expect(controller.snapshot('doc')).toMatchObject({mode: 'defaults', values: {strokeWidth: 4}});
    selected = [{object: line}, {object: line}]; expect(controller.snapshot('doc')).toBeNull();
    selected = []; active = {id: 'ordinary', defaults: {strokeWidth: 1}};
    expect(controller.snapshot('doc')).toBeNull(); expect(translated).toHaveBeenCalledWith('doc', expect.any(String), 'Distância');
    expect(controller.createBridge().colorPresets()).toEqual(['#123456']);
  });

  it('routes style edits to the document selection or tool defaults and excludes unrelated selections', () => {
    let selected = [{object: line}];
    const updateAnnotation = vi.fn(), setToolDefaults = vi.fn(), forDocument = vi.fn(() => ({
      getSelectedAnnotations: () => selected, getActiveTool: () => ({id: 'measure-distance', defaults: {}}), updateAnnotation
    }));
    const controller = new MeasurementStyleController({getAnnotation: () => ({forDocument, setToolDefaults}) as unknown as AnnotationCapability,
      translate: (_doc, _key, fallback) => fallback});
    controller.update('other', 'strokeWidth', 3);
    expect(forDocument).toHaveBeenCalledWith('other'); expect(updateAnnotation).toHaveBeenCalledWith(1, 'line', {strokeWidth: 3});
    controller.update('other', 'fillPattern', 'solid'); expect(updateAnnotation).toHaveBeenCalledOnce();
    selected = []; controller.update('other', 'strokeWidth', 4);
    expect(setToolDefaults).toHaveBeenCalledWith('measure-distance', {strokeWidth: 4});
    selected = [{object: {...line, custom: {}}}]; controller.update('other', 'strokeWidth', 5);
    expect(updateAnnotation).toHaveBeenCalledOnce(); expect(setToolDefaults).toHaveBeenCalledOnce();
  });

  it('builds measurement snapshots and navigation without importing a renderer, including late capability availability', () => {
    let annotation: AnnotationCapability | undefined;
    const selectAnnotation = vi.fn(), scrollToPage = vi.fn(), forDocument = vi.fn(() => ({
      getAnnotations: () => [{object: line}], getSelectedAnnotationIds: () => ['ordinary', 'line'], selectAnnotation
    }));
    const bridge = createMeasurementSidebarController({getAnnotation: () => annotation,
      getScroll: () => ({forDocument: () => ({scrollToPage})}) as unknown as ScrollCapability,
      getCalibration: () => ({linearFactor: 0.1, unit: 'm', precision: 2}), actions: {},
      translate: (_doc, _key, fallback) => fallback});
    expect(bridge.snapshot('doc')).toEqual({items: [], selectedId: null});
    annotation = {forDocument} as unknown as AnnotationCapability;
    const snapshot = bridge.snapshot('other'); expect(snapshot.selectedId).toBe('line'); expect(snapshot.items).toHaveLength(1);
    bridge.navigate('other', snapshot.items[0]); expect(forDocument).toHaveBeenCalledWith('other');
    expect(scrollToPage).toHaveBeenCalledWith({pageNumber: 2, pageCoordinates: {x: 25, y: 40}, behavior: 'smooth', alignX: 50, alignY: 50});
    expect(selectAnnotation).toHaveBeenCalledWith(1, 'line');
  });

  it('clears stale expanded/detail state on document change, selection change or removal', () => {
    const state = new MeasurementSidebarSelection(); state.setDocument('a');
    state.expandedId = 'same'; state.activeDetail = 'same:vertex:1';
    state.synchronize({items: [{id: 'same'}] as MeasurementSidebarItem[], selectedId: 'same'});
    expect(state.activeDetail).toBe('same:vertex:1');
    state.setDocument('b'); expect(state.expandedId).toBeNull(); expect(state.activeDetail).toBeNull();
    state.expandedId = 'deleted'; state.synchronize({items: [], selectedId: null}); expect(state.expandedId).toBeNull();
  });

  it('builds technical comment snapshots, navigates and removes only recognized comments', () => {
    const comment = decorateTechnicalComment({id: 'comment', pageIndex: 0, type: PdfAnnotationSubtype.TEXT,
      rect: {origin: {x: 0, y: 0}, size: {width: 20, height: 20}}} as never, 'note', 1, 'Conferir');
    const ordinary = {...comment, id: 'ordinary', custom: {}, subject: '', intent: ''} as PdfAnnotationObject;
    const deleteAnnotation = vi.fn(), selectAnnotation = vi.fn(), scrollToPage = vi.fn(), onChange = vi.fn();
    const annotation = {forDocument: () => ({getAnnotations: () => [{object: comment}, {object: ordinary}],
      getSelectedAnnotationIds: () => ['ordinary', 'comment'], getActiveTool: () => ({id: TECHNICAL_COMMENT_TOOL_ID}),
      deleteAnnotation, selectAnnotation})} as unknown as AnnotationCapability;
    const bridge = createTechnicalCommentSidebarController({getAnnotation: () => annotation,
      getScroll: () => ({forDocument: () => ({scrollToPage})}) as unknown as ScrollCapability,
      getCreationKind: () => 'note', getLegendVisible: () => false, onChange,
      actions: {update: vi.fn(), setCreationKind: vi.fn(), setLegendVisible: vi.fn(), startCreating: vi.fn(),
        translate: (_doc, _key, fallback) => fallback}});
    const snapshot = bridge.snapshot('doc'); expect(snapshot).toMatchObject({selectedId: 'comment', creating: true, legendVisible: false});
    expect(snapshot.items).toHaveLength(1); bridge.navigate('doc', snapshot.items[0]); expect(selectAnnotation).toHaveBeenCalledWith(0, 'comment');
    bridge.remove('doc', 'ordinary'); expect(deleteAnnotation).not.toHaveBeenCalled();
    bridge.remove('doc', 'comment'); expect(deleteAnnotation).toHaveBeenCalledWith(0, 'comment'); expect(onChange).toHaveBeenCalledTimes(2);
  });
});
