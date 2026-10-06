import {defineComponent, h} from 'vue';
import {MarkFlowPanel} from '@elvispdosreis/markflow-core/panel-vue';
export const MarkFlowMeasurementSidebar = defineComponent({name: 'MarkFlowMeasurementSidebar', inheritAttrs: false, props: {documentId: {type: String, required: true}}, setup: (props, {attrs}) => () => h(MarkFlowPanel, {...attrs, documentId: props.documentId, kind: 'measurement-sidebar'})});
