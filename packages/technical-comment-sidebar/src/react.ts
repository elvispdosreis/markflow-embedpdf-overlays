'use client';
import {createElement, type ReactElement} from 'react';
import {MarkFlowPanel, type MarkFlowPanelProps} from '@elvisreis/markflow-core/panel-react';
export type MarkFlowTechnicalCommentSidebarProps = Omit<MarkFlowPanelProps, 'kind'>;
export function MarkFlowTechnicalCommentSidebar(props: MarkFlowTechnicalCommentSidebarProps): ReactElement {return createElement(MarkFlowPanel, {...props, kind: 'technical-comment-sidebar'});}
