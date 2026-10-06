import type {I18nCapability} from '@embedpdf/snippet';
import {describe, expect, it} from 'vitest';
import {registerMeasurementTranslations} from './measurement-i18n';

describe('measurement sidebar translations', () => {
  it('registers native sidebar copy in Portuguese and English', () => {
    const locales = new Map([
      ['pt-BR', {translations: {}}],
      ['en', {translations: {}}]
    ]);
    const i18n = {getLocaleInfo: (code: string) => locales.get(code)} as I18nCapability;

    registerMeasurementTranslations(i18n);

    expect(locales.get('pt-BR')!.translations).toMatchObject({markflow: {measurements: {sidebar: {
      title: 'Medições', empty: 'Nenhuma medição', next: 'Próxima medição'
    }}}});
    expect(locales.get('en')!.translations).toMatchObject({markflow: {measurements: {sidebar: {
      title: 'Measurements', empty: 'No measurements', next: 'Next measurement'
    }}}});
  });
});
