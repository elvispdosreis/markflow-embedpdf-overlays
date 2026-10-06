import {MARKFLOW_NAMESPACE} from './xfdf-schema';

/** Compatibility ends at midnight in São Paulo, one year after migration. */
export const LEGACY_XFDF_EXPIRES_AT = '2027-10-06T00:00:00-03:00';
const LEGACY_NAMESPACE = 'https://rlz.com.br/ns/xfdf/measure/1.0';
const intents: Record<string, string> = {RLZArcMeasurement: 'MarkFlowArcMeasurement', RLZTechnicalComment: 'MarkFlowTechnicalComment'};
const identifiers = new Set(['name', 'inreplyto', 'ref']);

/** Import boundary for retired identifiers; annotation text is never changed. */
export function normalizeLegacyXfdf(document: Document, now = Date.now()): boolean {
  const elements = Array.from(document.getElementsByTagName('*'));
  const legacyAttribute = (attribute: Attr) => attribute.namespaceURI === LEGACY_NAMESPACE
    || attribute.name === 'xmlns:rlz' || attribute.prefix === 'rlz'
    || (identifiers.has(attribute.name) && attribute.value.startsWith('rlz-'))
    || (attribute.name === 'intent' && Object.hasOwn(intents, attribute.value))
    || (attribute.name === 'subject' && attribute.value.startsWith('RLZComment:'));
  if (!elements.some(element => element.namespaceURI === LEGACY_NAMESPACE || Array.from(element.attributes).some(legacyAttribute))) return false;
  if (now >= Date.parse(LEGACY_XFDF_EXPIRES_AT)) {
    throw new Error('A compatibilidade com XFDF legado RLZ encerrou em 06/10/2027. Converta o arquivo para o formato MarkFlow atual.');
  }
  for (let element of elements) {
    if (element.namespaceURI === LEGACY_NAMESPACE) {
      const replacement = document.createElementNS(MARKFLOW_NAMESPACE, `markflow:${element.localName}`);
      for (const attribute of Array.from(element.attributes)) replacement.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
      while (element.firstChild) replacement.appendChild(element.firstChild);
      element.replaceWith(replacement);
      element = replacement;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.namespaceURI === LEGACY_NAMESPACE || attribute.prefix === 'rlz') {
        if (!element.hasAttributeNS(MARKFLOW_NAMESPACE, attribute.localName)) element.setAttributeNS(MARKFLOW_NAMESPACE, `markflow:${attribute.localName}`, attribute.value);
        element.removeAttributeNode(attribute);
      } else if (attribute.name === 'xmlns:rlz') element.removeAttributeNode(attribute);
      else if (identifiers.has(attribute.name) && attribute.value.startsWith('rlz-')) element.setAttribute(attribute.name, `markflow-${attribute.value.slice(4)}`);
      else if (attribute.name === 'intent' && Object.hasOwn(intents, attribute.value)) element.setAttribute('intent', intents[attribute.value]);
      else if (attribute.name === 'subject' && attribute.value.startsWith('RLZComment:')) element.setAttribute('subject', `MarkFlowComment:${attribute.value.slice(11)}`);
    }
  }
  document.documentElement.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:markflow', MARKFLOW_NAMESPACE);
  return true;
}
