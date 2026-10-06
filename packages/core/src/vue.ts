import {defineComponent, h, shallowRef, onMounted, onBeforeUnmount, watchEffect, type PropType} from 'vue';
import {mountOverlayView, type OverlayKind, type OverlayViewDependencies, type OverlayViewMount} from './index';
import {liveDependencies} from './live-dependencies';

export const ViewerOverlay = defineComponent({
  name: 'ViewerOverlay',
  inheritAttrs: false,
  props: {
    kind: {type: String as PropType<OverlayKind>, required: true},
    options: {type: Object as PropType<OverlayViewDependencies>, required: true}
  },
  setup(props, {attrs}) {
    const host = shallowRef<HTMLDivElement | null>(null);
    let mounted: OverlayViewMount | null = null;
    let kind: OverlayKind | undefined, state: OverlayViewDependencies['state'] | undefined;
    let stop: (() => void) | undefined;
    onMounted(() => {
      stop = watchEffect(() => {
        if (!host.value) return;
        if (!mounted || kind !== props.kind || state !== props.options.state) {
          mounted?.destroy(); kind = props.kind; state = props.options.state;
          mounted = mountOverlayView(kind, host.value, liveDependencies(() => props.options));
        }
        mounted.update();
      }, {flush: 'post'});
    });
    onBeforeUnmount(() => {stop?.(); mounted?.destroy(); mounted = null;});
    return () => h('div', {...attrs, ref: host, 'data-markflow-overlay': props.kind});
  }
});
function overlay(name: string, kind: OverlayKind) {
  return defineComponent({
    name, inheritAttrs: false,
    props: {options: {type: Object as PropType<OverlayViewDependencies>, required: true}},
    setup: (props, {attrs}) => () => h(ViewerOverlay, {...attrs, options: props.options, kind})
  });
}
export const ViewerGuides = overlay('ViewerGuides', 'guides');
export const ViewerRulers = overlay('ViewerRulers', 'rulers');
export const ViewerCrosshair = overlay('ViewerCrosshair', 'crosshair');
