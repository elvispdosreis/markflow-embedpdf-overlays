import {defineComponent, h} from 'vue';
import {MarkFlowPanel} from '@elvispdosreis/markflow-core/panel-vue';
export const MarkFlowTechnicalCommentSidebar = defineComponent({name: 'MarkFlowTechnicalCommentSidebar', inheritAttrs: false, props: {documentId: {type: String, required: true}}, setup: (props, {attrs}) => () => h(MarkFlowPanel, {...attrs, documentId: props.documentId, kind: 'technical-comment-sidebar'})});
