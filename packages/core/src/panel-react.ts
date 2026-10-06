'use client';
import {createElement, useEffect, useRef, type ReactElement} from 'react';
import {mountPanel, type PanelKind} from './panel-host';
export interface MarkFlowPanelProps {kind: PanelKind; documentId: string; className?: string;}
export function MarkFlowPanel({kind, documentId, className}: MarkFlowPanelProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {if (host.current) return mountPanel(kind, host.current, documentId);}, [kind, documentId]);
  return createElement('div', {ref: host, className, style: {height: '100%'}, 'data-markflow-panel': kind});
}
