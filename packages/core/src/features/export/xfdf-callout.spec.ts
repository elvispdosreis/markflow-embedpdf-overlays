import {PdfAnnotationLineEnding, type PdfFreeTextAnnoObject} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {createXfdf, parseXfdf} from './xfdf-export';
import {convertXfdfCoordinates, type XfdfDocument} from './xfdf-coordinates';

const source = `<xfdf xmlns="http://ns.adobe.com/xfdf/"><annots>
  <freetext page="0" name="legacy-callout" rect="100,640,350,710" color="#20CDD0"
    interior-color="#FFFFFF" FontSize="12" TextColor="#20CDD0" IT="FreeTextCallout"
    fringe="80,0.5,0.5,20" callout="101,709,150,675,180,675" head="OpenArrow">
    <contents>Rever recadastramento.</contents>
    <defaultstyle>font: Helvetica 12pt; text-align: left; text-vertical-align: top; color: #20CDD0</defaultstyle>
  </freetext>
</annots></xfdf>`;
const document = {pages: [{index: 0, size: {width: 600, height: 800}, rotation: 0}], normalizedRotation: false} as XfdfDocument;
const imported = (xml = source, pdf = document) => parseXfdf(xml, {document: pdf}).annotations[0] as PdfFreeTextAnnoObject;

describe('legacy FreeText callouts', () => {
  it('keeps the leader and the smaller text box instead of stretching text over the overall bounds', () => {
    expect(imported()).toMatchObject({
      intent: 'FreeTextCallout',
      rect: {origin: {x: 100, y: 90}, size: {width: 250, height: 70}},
      calloutLine: [{x: 101, y: 91}, {x: 150, y: 125}, {x: 180, y: 125}],
      rectangleDifferences: {left: 80, top: 20, right: 0.5, bottom: 0.5},
      lineEnding: PdfAnnotationLineEnding.OpenArrow,
      textAlign: 0, verticalAlign: 0, fontSize: 12, fontColor: '#20CDD0', color: '#FFFFFF'
    });
  });

  it.each([
    [0, {left: 80, top: 20, right: 0.5, bottom: 0.5}, {x: 101, y: 91}],
    [1, {left: 0.5, top: 80, right: 20, bottom: 0.5}, {x: 709, y: 101}],
    [2, {left: 0.5, top: 0.5, right: 80, bottom: 20}, {x: 499, y: 709}],
    [3, {left: 20, top: 0.5, right: 0.5, bottom: 80}, {x: 91, y: 499}]
  ])('converts callout insets and leader on page rotation %s', (rotation, insets, tip) => {
    const pdf = {...document, pages: [{...document.pages[0], rotation,
      size: rotation % 2 ? {width: 800, height: 600} : {width: 600, height: 800}}]} as XfdfDocument;
    const annotation = imported(source, pdf);
    expect(annotation.rectangleDifferences).toEqual(insets);
    expect(annotation.calloutLine?.[0]).toEqual(tip);
    const restored = convertXfdfCoordinates(annotation, pdf, true) as PdfFreeTextAnnoObject;
    expect(restored.rectangleDifferences).toEqual({left: 80, top: 20, right: 0.5, bottom: 0.5});
    expect(restored.calloutLine).toEqual([{x: 101, y: 709}, {x: 150, y: 675}, {x: 180, y: 675}]);
  });

  it('preserves callout geometry and alignment after saving and reloading RLZ XFDF', () => {
    const annotation = imported();
    const restored = parseXfdf(createXfdf([annotation])).annotations[0];
    expect(restored).toMatchObject({
      calloutLine: [{x: 101, y: 91}, {x: 150, y: 125}, {x: 180, y: 125}],
      rectangleDifferences: {left: 80, top: 20, right: 0.5, bottom: 0.5},
      lineEnding: PdfAnnotationLineEnding.OpenArrow, textAlign: 0, verticalAlign: 0
    });
  });

  it('keeps simple two-point leaders', () => {
    expect(imported(source.replace('101,709,150,675,180,675', '101,709,180,675')).calloutLine)
      .toEqual([{x: 101, y: 91}, {x: 180, y: 125}]);
  });

  it('recovers geometry lost by older RLZ saves from the same annotation embedded in the PDF', () => {
    const damaged = `<xfdf xmlns="http://ns.adobe.com/xfdf/" xmlns:markflow="urn:markflow:xfdf:1">
      <annots><freetext page="0" name="legacy-callout" rect="100,90,350,160" intent="FreeTextCallout">
      <contents>Texto atualizado</contents></freetext></annots></xfdf>`;
    const restored = parseXfdf(damaged, {originalAnnotations: [imported()]}).annotations[0];
    expect(restored).toMatchObject({
      contents: 'Texto atualizado',
      calloutLine: [{x: 101, y: 91}, {x: 150, y: 125}, {x: 180, y: 125}],
      rectangleDifferences: {left: 80, top: 20, right: 0.5, bottom: 0.5},
      lineEnding: PdfAnnotationLineEnding.OpenArrow, textAlign: 0, verticalAlign: 0
    });
  });

  it('keeps complete saved EmbedPDF callouts even if an older original is available', () => {
    const saved = {...imported(), calloutLine: [{x: 50, y: 70}, {x: 180, y: 125}], textAlign: 2} as PdfFreeTextAnnoObject;
    const restored = parseXfdf(createXfdf([saved]), {originalAnnotations: [imported()]}).annotations[0];
    expect(restored).toMatchObject({calloutLine: [{x: 50, y: 70}, {x: 180, y: 125}], textAlign: 2});
  });
});
