import {defineComponent, h, shallowRef, onMounted, onBeforeUnmount, watchEffect, type PropType} from 'vue';
import {mountPanel, type PanelKind} from './panel-host';
export const MarkFlowPanel = defineComponent({name: 'MarkFlowPanel', inheritAttrs: false,
  props: {kind: {type: String as PropType<PanelKind>, required: true}, documentId: {type: String, required: true}},
  setup(props, {attrs}) {
    const host = shallowRef<HTMLElement | null>(null); let stop: (() => void) | undefined;
    onMounted(() => {stop = watchEffect(onCleanup => {if (host.value) onCleanup(mountPanel(props.kind, host.value, props.documentId));}, {flush: 'post'});});
    onBeforeUnmount(() => stop?.());
    return () => h('div', {...attrs, ref: host, style: {height: '100%'}, 'data-markflow-panel': props.kind});
  }
});
