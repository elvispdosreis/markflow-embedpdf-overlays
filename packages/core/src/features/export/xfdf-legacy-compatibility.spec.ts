import {afterEach, describe, expect, it, vi} from 'vitest';
import {createXfdf, parseXfdf} from './xfdf-export';
import {LEGACY_XFDF_EXPIRES_AT, normalizeLegacyXfdf} from './xfdf-legacy-compatibility';
import {MARKFLOW_NAMESPACE} from './xfdf-schema';

const legacy = `<xfdf xmlns="http://ns.adobe.com/xfdf/" xmlns:rlz="https://rlz.com.br/ns/xfdf/measure/1.0">
  <annots><text name="rlz-comment-1" page="0" rect="0,0,20,20" subject="RLZComment:note:1" rlz:comment-kind="note" rlz:comment-number="1"><contents>Texto rlz-original</contents></text>
  <text name="rlz-reply-1" inreplyto="rlz-comment-1" page="0" rect="0,0,20,20"/></annots>
  <rlz:calibration linear-factor="0.5" unit="m" precision="2"/>
</xfdf>`;
const xml = (source: string) => new DOMParser().parseFromString(source, 'application/xml');
const expires = Date.parse(LEGACY_XFDF_EXPIRES_AT);

describe('one year XFDF legacy import boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('migrates names, reply references, subjects and calibration without rewriting contents', () => {
    const document = xml(legacy);
    expect(normalizeLegacyXfdf(document, expires - 1)).toBe(true);
    const annotations = document.getElementsByTagNameNS('*', 'text');
    expect(annotations[0].getAttribute('name')).toBe('markflow-comment-1');
    expect(annotations[1].getAttribute('inreplyto')).toBe('markflow-comment-1');
    expect(annotations[0].getAttribute('subject')).toBe('MarkFlowComment:note:1');
    expect(annotations[0].getAttributeNS(MARKFLOW_NAMESPACE, 'comment-number')).toBe('1');
    expect(document.getElementsByTagNameNS(MARKFLOW_NAMESPACE, 'calibration')).toHaveLength(1);
    expect(document.getElementsByTagNameNS('*', 'contents')[0].textContent).toBe('Texto rlz-original');
    expect(document.documentElement.hasAttribute('xmlns:rlz')).toBe(false);
    expect(normalizeLegacyXfdf(document, expires)).toBe(false);
  });

  it('exports imported legacy data using only the current identifiers and namespace', () => {
    vi.spyOn(Date, 'now').mockReturnValue(expires - 1);
    const imported = parseXfdf(legacy);
    expect(imported.source).toBe('native');
    expect(imported.calibration?.linearFactor).toBe(0.5);
    const exported = createXfdf(imported.annotations, {calibration: imported.calibration});
    expect(exported).toContain('xmlns:markflow="urn:markflow:xfdf:1"');
    expect(exported).toContain('markflow-comment-1');
    expect(exported).toContain('markflow:calibration');
    expect(exported).not.toMatch(/name="rlz-|inreplyto="rlz-|rlz:|RLZComment|https:\/\/rlz\.com\.br/);
  });

  it('rejects legacy files at the exact deadline with an actionable error', () => {
    vi.spyOn(Date, 'now').mockReturnValue(expires);
    expect(() => parseXfdf(legacy)).toThrow('06/10/2027');
  });

  it('accepts current and generic files after the legacy deadline', () => {
    vi.spyOn(Date, 'now').mockReturnValue(expires + 1);
    expect(parseXfdf(createXfdf([])).source).toBe('native');
    expect(parseXfdf('<xfdf><annots/></xfdf>').source).toBe('generic');
  });

  it('recognizes the old namespace under an alternate XML prefix and keeps current metadata', () => {
    const document = xml(`<xfdf xmlns:old="https://rlz.com.br/ns/xfdf/measure/1.0" xmlns:markflow="${MARKFLOW_NAMESPACE}"><annots><polyline intent="RLZArcMeasurement" old:measurement-kind="arc" old:unit="cm" markflow:unit="m"/></annots></xfdf>`);
    normalizeLegacyXfdf(document, expires - 1);
    const annotation = document.getElementsByTagName('polyline')[0];
    expect(annotation.getAttribute('intent')).toBe('MarkFlowArcMeasurement');
    expect(annotation.getAttributeNS(MARKFLOW_NAMESPACE, 'measurement-kind')).toBe('arc');
    expect(annotation.getAttributeNS(MARKFLOW_NAMESPACE, 'unit')).toBe('m');
    expect(annotation.hasAttribute('old:unit')).toBe(false);
  });

  it('treats legacy identifiers without a namespace as legacy imports', () => {
    expect(() => normalizeLegacyXfdf(xml('<xfdf><annots><text name="rlz-note"/></annots></xfdf>'), expires)).toThrow('06/10/2027');
  });
});
