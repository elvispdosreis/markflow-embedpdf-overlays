import {describe, expect, it, vi} from 'vitest';
import {PdfAnnotationSubtype, type PdfAnnotationObject} from '@embedpdf/models';
import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {HistoryCapability} from '@embedpdf/plugin-history';
import {MeasurementHistory} from './measurement-history';

function fixture() {
  const docs = new Map<string, PdfAnnotationObject[]>();
  const restored = vi.fn(), changed = vi.fn(), purge = vi.fn();
  const deleted = vi.fn(), imported = vi.fn();
  const source = (id: string) => ({id, pageIndex: 0, type: PdfAnnotationSubtype.LINE,
    custom: {measurementKind: 'distance'}, linePoints: {start: {x: 0, y: 0}, end: {x: 10, y: 0}}
  }) as PdfAnnotationObject;
  const family = (id: string) => [source(id), {id: `${id}-label`, pageIndex: 0, type: PdfAnnotationSubtype.FREETEXT,
    custom: {measurementDecorationFor: id}} as PdfAnnotationObject];
  const annotation = {forDocument: (doc: string) => ({
    getAnnotations: () => (docs.get(doc) ?? []).map(object => ({object})),
    getAnnotationById: (id: string) => {const object = docs.get(doc)?.find(item => item.id === id); return object ? {object} : null;},
    deleteAnnotation: (page: number, id: string) => {
      deleted(doc, page, id); docs.set(doc, (docs.get(doc) ?? []).filter(item => item.id !== id && item.custom?.['measurementDecorationFor'] !== id));
    },
    importAnnotations: (items: {annotation: PdfAnnotationObject}[]) => {
      imported(doc, items); docs.set(doc, [...(docs.get(doc) ?? []), ...items.map(item => item.annotation)]);
    }
  })} as unknown as AnnotationCapability;
  const history = new MeasurementHistory({getAnnotation: () => annotation,
    getHistory: () => ({forDocument: () => ({purgeByMetadata: purge})}) as unknown as HistoryCapability,
    onRestore: restored, onChange: changed});
  return {docs, source, family, history, restored, changed, purge, deleted, imported};
}

describe('MeasurementHistory', () => {
  it('records a family once, purges only matching native history and restores a detached snapshot', () => {
    const f = fixture(), family = f.family('m'); f.docs.set('a', family);
    f.history.recordCreation('a', family[0]); f.history.recordCreation('a', family[0]);
    expect(f.purge).toHaveBeenCalledOnce();
    const predicate = f.purge.mock.calls[0][0];
    expect(predicate({annotationIds: ['m-label']})).toBe(true);
    expect(predicate({annotationIds: ['ordinary']})).toBe(false);
    family[0].custom!['later'] = true;
    f.history.undo('a'); expect(f.deleted).toHaveBeenCalledWith('a', 0, 'm');
    expect(f.history.canUndo('a')).toBe(false); expect(f.history.canRedo('a')).toBe(true);
    f.history.redo('a'); expect(f.docs.get('a')).toHaveLength(2);
    expect(f.restored.mock.calls[0][1].custom.later).toBeUndefined();
    expect(f.history.canRedo('a')).toBe(false); expect(f.history.canUndo('a')).toBe(true);
  });

  it('keeps stacks isolated for documents with identical annotation IDs', () => {
    const f = fixture(); f.docs.set('a', f.family('same')); f.docs.set('b', f.family('same'));
    f.history.recordCreation('a', f.docs.get('a')![0]); f.history.recordCreation('b', f.docs.get('b')![0]);
    f.history.undo('a'); expect(f.docs.get('a')).toEqual([]); expect(f.docs.get('b')).toHaveLength(2);
    expect(f.history.canUndo('b')).toBe(true); expect(f.history.canRedo('b')).toBe(false);
  });

  it('does not record loaded measurements and permits a retry when a source is not yet present', () => {
    const f = fixture(); f.docs.set('a', f.family('loaded'));
    f.history.markLoaded('a', ['loaded']); f.history.recordCreation('a', f.docs.get('a')![0]);
    expect(f.history.canUndo('a')).toBe(false);
    f.history.recordCreation('a', f.source('new')); expect(f.history.canUndo('a')).toBe(false);
    f.docs.set('a', f.family('new')); f.history.recordCreation('a', f.docs.get('a')![0]);
    expect(f.history.canUndo('a')).toBe(true);
  });

  it('invalidates redo only for a new creation in the same document', () => {
    const f = fixture(); f.docs.set('a', f.family('first')); f.history.recordCreation('a', f.docs.get('a')![0]);
    f.history.undo('a'); f.docs.set('b', f.family('other')); f.history.recordCreation('b', f.docs.get('b')![0]);
    expect(f.history.canRedo('a')).toBe(true);
    f.docs.set('a', f.family('new')); f.history.recordCreation('a', f.docs.get('a')![0]);
    expect(f.history.canRedo('a')).toBe(false);
  });

  it('keeps a failed operation retryable and ignores creation events emitted during redo', () => {
    const f = fixture(); f.docs.set('a', f.family('m')); f.history.recordCreation('a', f.docs.get('a')![0]);
    f.deleted.mockImplementationOnce(() => {throw new Error('failed');});
    expect(() => f.history.undo('a')).toThrow('failed'); expect(f.history.canUndo('a')).toBe(true);
    f.history.undo('a');
    f.imported.mockImplementationOnce(() => f.history.recordCreation('a', f.source('unexpected')));
    f.history.redo('a'); f.history.undo('a'); expect(f.history.canUndo('a')).toBe(false);
  });

  it('clears closed documents and releases all history on disposal', () => {
    const f = fixture(); f.docs.set('a', f.family('m')); f.history.recordCreation('a', f.docs.get('a')![0]);
    f.history.close('a'); expect(f.history.canUndo('a')).toBe(false); f.history.undo('a');
    expect(f.deleted).not.toHaveBeenCalled();
    f.history.recordCreation('a', f.docs.get('a')![0]); expect(f.history.canUndo('a')).toBe(true);
    f.history.clear(); expect(f.history.canUndo('a')).toBe(false);
  });
});
