import {defineComponent, h, shallowRef, onMounted, onBeforeUnmount, watchEffect, type PropType} from 'vue';
import {mountSigner, type SignerMount, type SignerOptions} from './mount';
import {mountSignerViewer, type SignerViewerMount, type SignerViewerOptions} from './viewer';
export const MarkFlowSigner = defineComponent({
  name: 'MarkFlowSigner', inheritAttrs: false,
  props: {options: {type: Object as PropType<SignerOptions>, required: true}},
  setup(props, {attrs}) {
    const host = shallowRef<HTMLElement | null>(null);
    let mounted: SignerMount | null = null, stop: (() => void) | undefined;
    onMounted(() => {stop = watchEffect(() => {
      if (!host.value) return;
      if (mounted) mounted.update(props.options); else mounted = mountSigner(host.value, props.options);
    }, {flush: 'post'});});
    onBeforeUnmount(() => {stop?.(); mounted?.destroy(); mounted = null;});
    return () => h('div', {...attrs, ref: host, 'data-markflow-overlay': 'signer'});
  }
});
export const MarkFlowSignerViewer = defineComponent({
  name: 'MarkFlowSignerViewer', inheritAttrs: false,
  props: {options: {type: Object as PropType<SignerViewerOptions>, required: true}},
  setup(props, {attrs}) {
    const host = shallowRef<HTMLElement | null>(null);
    let mounted: SignerViewerMount | null = null, stop: (() => void) | undefined;
    let viewer: HTMLElement | undefined, registry: SignerViewerOptions['registry'] | undefined;
    onMounted(() => {stop = watchEffect(() => {
      if (!host.value) return;
      if (!mounted || viewer !== props.options.viewer || registry !== props.options.registry) {
        mounted?.destroy(); viewer = props.options.viewer; registry = props.options.registry;
        mounted = mountSignerViewer(host.value, props.options);
      } else mounted.update(props.options);
    }, {flush: 'post'});});
    onBeforeUnmount(() => {stop?.(); mounted?.destroy(); mounted = null;});
    return () => h('div', {...attrs, ref: host, 'data-markflow-overlay': 'signer-viewer'});
  }
});
