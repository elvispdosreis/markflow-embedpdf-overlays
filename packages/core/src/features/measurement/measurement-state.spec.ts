import {describe, expect, it, vi} from 'vitest';
import {MeasurementState} from './measurement-state';
import type {MeasurementRecord} from './measurement.models';

const item = (annotationId: string, rawValue = 1): MeasurementRecord => ({annotationId, pageIndex: 0,
  kind: 'distance', rawValue, formattedValue: `${rawValue} m`, quantity: 'length'});

describe('MeasurementState', () => {
  it('isolates equal annotation IDs across documents and publishes only the active document', () => {
    const changed = vi.fn(), state = new MeasurementState(changed);
    state.activate('a'); state.upsert('a', item('same', 1)); changed.mockClear();
    state.upsert('b', item('same', 2)); expect(changed).not.toHaveBeenCalled();
    state.activate('b'); expect(changed).toHaveBeenLastCalledWith([item('same', 2)]);
    state.activate('a'); expect(changed).toHaveBeenLastCalledWith([item('same', 1)]);
  });

  it('keeps recent results distinct and bounded without sharing mutable records', () => {
    const state = new MeasurementState(vi.fn(), 2), source = item('a');
    state.replace('doc', [source, item('a', 7), item('b'), item('c')]);
    source.rawValue = 9; const result = state.get('doc'); result[0].rawValue = 8;
    expect(state.get('doc')).toEqual([item('a'), item('b')]);
    state.upsert('doc', item('b', 3)); expect(state.get('doc')).toEqual([item('b', 3), item('a')]);
  });

  it('updates and removes results without affecting other documents', () => {
    const state = new MeasurementState(vi.fn()); state.upsert('a', item('same')); state.upsert('b', item('same'));
    state.update('a', items => items.map(current => ({...current, rawValue: 5})));
    expect(state.get('a')[0].rawValue).toBe(5); expect(state.get('b')[0].rawValue).toBe(1);
    state.remove('a', 'same'); expect(state.get('a')).toEqual([]); expect(state.get('b')).toHaveLength(1);
  });

  it('releases document state on close and clears the active UI on destruction', () => {
    const changed = vi.fn(), state = new MeasurementState(changed);
    state.activate('a'); state.upsert('a', item('a')); state.upsert('b', item('b'));
    state.close('b'); expect(state.get('b')).toEqual([]);
    expect(changed).toHaveBeenLastCalledWith([item('a')]);
    state.close('a'); expect(changed).toHaveBeenLastCalledWith([]);
    state.upsert('c', item('c')); state.clear(); expect(state.get('c')).toEqual([]);
  });
});
