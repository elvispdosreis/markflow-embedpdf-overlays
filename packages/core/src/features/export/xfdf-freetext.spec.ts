import {PdfStandardFont} from '@embedpdf/models';
import {PdfAnnotationSubtype, type PdfFreeTextAnnoObject} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {createXfdf, parseXfdf} from './xfdf-export';
import type {XfdfDocument} from './xfdf-coordinates';

// In XFDF/PDF, a FreeText `color` (/C) is the box background. Apryse/PDFTron
// merges paint it as a fill, so the border must never be written there.
const note = {
  id: 'note', pageIndex: 0, type: PdfAnnotationSubtype.FREETEXT,
  rect: {origin: {x: 10, y: 20}, size: {width: 100, height: 30}},
  contents: 'rever hachura', author: '11189', opacity: 1, rotation: 90, flags: ['print'],
  strokeWidth: 1, strokeColor: 'transparent', color: 'transparent',
  fontFamily: PdfStandardFont.Helvetica, fontSize: 14, fontColor: '#E44234', textAlign: 0, verticalAlign: 0
} as unknown as PdfFreeTextAnnoObject;
const callout = {...note, id: 'callout', strokeColor: '#E44234', intent: 'FreeTextCallout'} as PdfFreeTextAnnoObject;
const document = {pages: [{index: 0, size: {width: 600, height: 800}, rotation: 0}], normalizedRotation: false} as XfdfDocument;
const element = (xfdf: string) => xfdf.match(/<freetext[\s\S]*?<\/freetext>/)?.[0] ?? '';
const imported = (xfdf: string) => parseXfdf(xfdf, {document}).annotations[0] as PdfFreeTextAnnoObject;

describe('FreeText XFDF colors', () => {
  it('writes a transparent text box without a background, border or invalid color', () => {
    const xml = element(createXfdf([note]));
    expect(xml).not.toMatch(/\scolor="/);
    expect(xml).not.toMatch(/\s(color|interior-color|TextColor)="transparent"/);
    expect(xml).toContain(' markflow:border-color="transparent"');
    expect(xml).toContain(' width="0"');
    expect(xml).toContain(' TextColor="#E44234"');
    expect(xml).toContain(' FontSize="14"');
    expect(xml).toContain(' justification="left"');
    expect(xml).toContain('<defaultappearance>0.894118 0.258824 0.203922 rg /Helvetica 14 Tf</defaultappearance>');
    expect(xml).toContain('<defaultstyle>font: Helvetica 14pt; text-align: left; text-vertical-align: top; color: #E44234</defaultstyle>');
  });

  it('writes the border in the appearance string and the background in color', () => {
    const xml = element(createXfdf([{...callout, color: '#FFFFFF'} as PdfFreeTextAnnoObject]));
    expect(xml).toContain(' color="#FFFFFF"');
    expect(xml).toContain(' width="1"');
    expect(xml).toContain(' markflow:border-color="#E44234"');
    expect(xml).toContain('<defaultappearance>0.894118 0.258824 0.203922 RG 0.894118 0.258824 0.203922 rg /Helvetica 14 Tf</defaultappearance>');
  });

  it('rewrites a stale imported default style with the current text style', () => {
    const edited = {...note, fontSize: 18, fontColor: '#597CE2', textAlign: 2,
      defaultStyle: 'font: Helvetica 12pt; text-align: left; color: #20CDD0; line-height: 1.2'} as PdfFreeTextAnnoObject;
    expect(element(createXfdf([edited]))).toContain(
      '<defaultstyle>font: Helvetica 18pt; text-align: right; text-vertical-align: top; color: #597CE2; line-height: 1.2</defaultstyle>');
  });

  it.each([callout, {...callout, color: '#FFFFFF'} as PdfFreeTextAnnoObject])('round-trips native colors ($id)', annotation => {
    expect(parseXfdf(createXfdf([annotation])).annotations[0]).toMatchObject({
      color: annotation.color, strokeColor: annotation.strokeColor, strokeWidth: 1, fontColor: '#E44234', fontSize: 14,
      fontFamily: PdfStandardFont.Helvetica, textAlign: 0, verticalAlign: 0
    });
  });

  // EmbedPDF discards the text of a FreeText whose border is 'transparent' when
  // saving the PDF; a box without border must import with no stroke color.
  it('imports a box without border as no stroke, never as a transparent stroke', () => {
    const restored = parseXfdf(createXfdf([note])).annotations[0] as PdfFreeTextAnnoObject;
    expect(restored.strokeColor).toBeUndefined();
    expect(restored).toMatchObject({strokeWidth: 0, color: 'transparent', fontColor: '#E44234', contents: 'rever hachura'});
  });

  it('keeps reading older MarkFlow/RLZ exports, where color was the border', () => {
    const legacy = `<xfdf xmlns="http://ns.adobe.com/xfdf/" xmlns:rlz="https://rlz.com.br/ns/xfdf/measure/1.0"><annots>
      <freetext page="0" rect="10,20,110,50" name="a" color="transparent" width="1" font="4" size="14" text-color="#E44234"><contents>a</contents></freetext>
      <freetext page="0" rect="10,20,110,50" name="b" intent="FreeTextCallout" color="#E44234" width="1" font="4" size="14" text-color="#E44234"><contents>b</contents></freetext>
    </annots></xfdf>`;
    const [plain, leader] = parseXfdf(legacy).annotations as PdfFreeTextAnnoObject[];
    expect(plain.strokeColor).toBeUndefined();
    expect(plain).toMatchObject({color: 'transparent', strokeWidth: 0, fontColor: '#E44234', fontSize: 14});
    expect(leader).toMatchObject({color: 'transparent', strokeColor: '#E44234', fontColor: '#E44234'});
  });

  it('reads standard XFDF color as the background and the appearance string as text style', () => {
    const apryse = `<xfdf xmlns="http://ns.adobe.com/xfdf/"><annots>
      <freetext page="0" rect="10,20,110,50" name="c" color="#FFFFFF" width="2" TextColor="#25D2D1" FontSize="14">
        <contents>c</contents><defaultappearance>0.145 0.824 0.82 rg /Helvetica 14 Tf</defaultappearance></freetext>
    </annots></xfdf>`;
    expect(imported(apryse)).toMatchObject({color: '#FFFFFF', strokeColor: '#25D2D1', fontColor: '#25D2D1', fontSize: 14});
  });

  it('falls back to the default appearance and style when the vendor attributes are absent', () => {
    const acrobat = `<xfdf xmlns="http://ns.adobe.com/xfdf/"><annots>
      <freetext page="0" rect="10,20,110,50" name="d" justification="centered">
        <contents>d</contents><defaultappearance>0 0 1 RG 1 0 0 rg /Times-Bold 11 Tf</defaultappearance></freetext>
    </annots></xfdf>`;
    expect(imported(acrobat)).toMatchObject({color: 'transparent', strokeColor: '#0000FF', fontColor: '#FF0000',
      fontSize: 11, fontFamily: PdfStandardFont.Times_Bold, textAlign: 1});
  });
});
