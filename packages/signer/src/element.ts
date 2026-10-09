import {mountSigner, type SignerMount, type SignerOptions} from './mount';
import {mountSignerViewer, type SignerViewerMount, type SignerViewerOptions} from './viewer';
export interface SignerElement extends HTMLElement {options: SignerOptions | undefined}
/** Angular uses property binding [options] and CUSTOM_ELEMENTS_SCHEMA; safe to import during SSR. */
export function registerSignerElement(name = 'markflow-signer'): void {
  if (typeof customElements === 'undefined' || customElements.get(name)) return;
  customElements.define(name, class extends HTMLElement implements SignerElement {
    private value: SignerOptions | undefined;
    private mounted: SignerMount | undefined;
    set options(options: SignerOptions | undefined) {this.value = options; this.sync();}
    get options(): SignerOptions | undefined {return this.value;}
    connectedCallback(): void {this.sync();}
    disconnectedCallback(): void {this.mounted?.destroy(); this.mounted = undefined;}
    private sync(): void {
      if (!this.isConnected) return;
      if (!this.value) {this.mounted?.destroy(); this.mounted = undefined; return;}
      if (this.mounted) this.mounted.update(this.value);
      else this.mounted = mountSigner(this, this.value);
    }
  });
}
export interface SignerViewerElement extends HTMLElement {options: SignerViewerOptions | undefined}
export function registerSignerViewerElement(name = 'markflow-signer-viewer'): void {
  if (typeof customElements === 'undefined' || customElements.get(name)) return;
  customElements.define(name, class extends HTMLElement implements SignerViewerElement {
    private value: SignerViewerOptions | undefined;
    private mounted: SignerViewerMount | undefined;
    set options(options: SignerViewerOptions | undefined) {this.value = options; this.sync();}
    get options(): SignerViewerOptions | undefined {return this.value;}
    connectedCallback(): void {this.sync();}
    disconnectedCallback(): void {this.mounted?.destroy(); this.mounted = undefined;}
    private sync(): void {
      if (!this.isConnected) return;
      if (!this.value) {this.mounted?.destroy(); this.mounted = undefined; return;}
      if (this.mounted) this.mounted.update(this.value);
      else this.mounted = mountSignerViewer(this, this.value);
    }
  });
}
