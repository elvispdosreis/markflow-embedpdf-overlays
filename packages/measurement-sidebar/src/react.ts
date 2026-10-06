'use client';
import {createElement, type ReactElement} from 'react';
import {MarkFlowPanel, type MarkFlowPanelProps} from '@elvispdosreis/markflow-core/panel-react';
export type MarkFlowMeasurementSidebarProps = Omit<MarkFlowPanelProps, 'kind'>;
export function MarkFlowMeasurementSidebar(props: MarkFlowMeasurementSidebarProps): ReactElement {return createElement(MarkFlowPanel, {...props, kind: 'measurement-sidebar'});}
