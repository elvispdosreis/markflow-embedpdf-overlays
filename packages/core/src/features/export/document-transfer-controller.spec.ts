import type {AnnotationCapability} from '@embedpdf/plugin-annotation';
import type {ExportCapability} from '@embedpdf/snippet';
import {PdfAnnotationSubtype, type PdfLineAnnoObject} from '@embedpdf/models';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {DocumentTransferController} from './document-transfer-controller';
import {createXfdf} from './xfdf-export';

const line: PdfLineAnnoObject = {
  id: 'line', pageIndex: 0, type: PdfAnnotationSubtype.LINE,
  rect: {origin: {x: 0, y: 0}, size: {width: 30, height: 40}},
  linePoints: {start: {x: 0, y: 0}, end: {x: 30, y: 40}},
  color: 'transparent', opacity: 1, strokeWidth: 1, strokeColor: '#ef4444', strokeStyle: 1
};
describe('DocumentTransferController', () => {
  afterEach(() => vi.useRealTimers());
  function setup() {
    let id = 'a';
    const imported = vi.fn(), calibration = vi.fn(), importAnnotations = vi.fn(), updateAnnotation = vi.fn();
    const scope = {getAnnotations: () => [{object: line}], getAnnotationById: () => ({object: line}),
      importAnnotations, updateAnnotation};
    const forDocument = vi.fn(() => scope);
    const bytes = new Uint8Array([1, 2, 3]);
    const controller = new DocumentTransferController({
      getAnnotation: () => ({forDocument} as unknown as AnnotationCapability),
      getExport: () => ({forDocument: () => ({saveAsCopy: () => ({toPromise: async () => bytes.buffer})})} as unknown as ExportCapability),
      getActiveDocumentId: () => id, getDocument: () => undefined, getFileName: () => 'planta.pdf',
      getCalibration: () => ({linearFactor: 2, unit: 'm', precision: 2}), isReady: () => true,
      onStatus: vi.fn(), onCalibration: calibration, onImported: imported
    });
    return {controller, imported, calibration, importAnnotations, updateAnnotation, forDocument,
      setId: (value: string) => {id = value;}, bytes};
  }
  it('imports colliding native XFDF annotations with new IDs and preserves calibration', async () => {
    vi.useFakeTimers();
    const s = setup();
    const text = createXfdf([line], {calibration: {linearFactor: 2, unit: 'm', precision: 2}});
    const input = {files: [{text: async () => text}], value: 'chosen'};
    await s.controller.importXfdf({target: input} as unknown as Event);
    const imported = s.importAnnotations.mock.calls[0][0][0].annotation;
    expect(imported.id).not.toBe('line');
    expect(imported.custom.sourceAnnotationId).toBe('line');
    expect(s.forDocument).toHaveBeenCalledWith('a');
    expect(s.calibration).toHaveBeenCalledWith(expect.objectContaining({linearFactor: 2, unit: 'm'}));
    vi.runAllTimers();
    expect(s.imported).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
    s.controller.destroy();
  });
  it('does not apply a file to a new document when it changes during the file read', async () => {
    const s = setup();
    let resolve!: (value: string) => void;
    const pending = new Promise<string>(done => {resolve = done;});
    const input = {files: [{text: () => pending}], value: 'chosen'};
    const importing = s.controller.importXfdf({target: input} as unknown as Event);
    s.setId('b');
    resolve(createXfdf([line]));
    await importing;
    expect(s.importAnnotations).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    s.controller.destroy();
  });
  it('returns the original PDF bytes when there are no technical comments', async () => {
    const s = setup();
    expect(await s.controller.exportMergedPdf('a')).toEqual(s.bytes);
    expect(s.forDocument).toHaveBeenCalledWith('a');
    s.controller.destroy();
  });
});
