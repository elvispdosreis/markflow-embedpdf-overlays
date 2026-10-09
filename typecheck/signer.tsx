import {SignerState, createSignerContext, mountSigner, mountSignerViewer, registerSignerElement,
  registerSignerViewerElement, type SignerOptions, type SignerViewerOptions, type SignatureRequest} from '@elvisreis/markflow-signer';
import {MarkFlowSigner, MarkFlowSignerViewer} from '@elvisreis/markflow-signer/react';
import {MarkFlowSigner as VueSigner, MarkFlowSignerViewer as VueSignerViewer} from '@elvisreis/markflow-signer/vue';
import type {PluginRegistry} from '@embedpdf/snippet';
import {h} from 'vue';
export function signerConsumer(registry: PluginRegistry, viewer: HTMLElement, host: HTMLElement) {
  const state = new SignerState();
  const context = createSignerContext(registry);
  if (!context) return;
  const options: SignerOptions = {state, context, documentId: 'doc', pageIndex: 0, initialPosition: {x: 40, y: 60}};
  const viewerOptions: SignerViewerOptions = {state, registry, viewer, initialPosition: {x: 40, y: 60, pageIndex: 1}};
  const page = mountSigner(host, options), fullViewer = mountSignerViewer(host, viewerOptions);
  page.update(options); fullViewer.update(viewerOptions);
  const request: SignatureRequest | null = state.confirm(context);
  registerSignerElement(); registerSignerViewerElement();
  const react = <><MarkFlowSigner options={options}/><MarkFlowSignerViewer options={viewerOptions}/></>;
  const vue = [h(VueSigner, {options}), h(VueSignerViewer, {options: viewerOptions})];
  page.destroy(); fullViewer.destroy(); state.destroy();
  return {react, vue, request};
}
