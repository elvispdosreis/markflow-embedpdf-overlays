'use client';
import {createElement, type ReactElement} from 'react';
import {MarkFlowPanel, type MarkFlowPanelProps} from '@elvispdosreis/markflow-core/panel-react';
export type MarkFlowMeasurementStyleProps = Omit<MarkFlowPanelProps, 'kind'>;
export function MarkFlowMeasurementStyle(props: MarkFlowMeasurementStyleProps): ReactElement {return createElement(MarkFlowPanel, {...props, kind: 'measurement-style'});}
