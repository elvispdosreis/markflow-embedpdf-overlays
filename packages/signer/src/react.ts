'use client';
import {createElement, useEffect, useRef, type ReactElement} from 'react';
import {mountSigner, type SignerMount, type SignerOptions} from './mount';
import {mountSignerViewer, type SignerViewerMount, type SignerViewerOptions} from './viewer';
export interface MarkFlowSignerProps {options: SignerOptions; className?: string}
export function MarkFlowSigner({options, className}: MarkFlowSignerProps): ReactElement {
  const host = useRef<HTMLDivElement>(null), mounted = useRef<SignerMount | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const view = mountSigner(host.current, options); mounted.current = view;
    return () => {view.destroy(); mounted.current = null;};
  }, [options.state, options.context, options.documentId, options.pageIndex]);
  useEffect(() => {mounted.current?.update(options);});
  return createElement('div', {ref: host, className, 'data-markflow-overlay': 'signer'});
}
export interface MarkFlowSignerViewerProps {options: SignerViewerOptions; className?: string}
export function MarkFlowSignerViewer({options, className}: MarkFlowSignerViewerProps): ReactElement {
  const host = useRef<HTMLDivElement>(null), mounted = useRef<SignerViewerMount | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const view = mountSignerViewer(host.current, options); mounted.current = view;
    return () => {view.destroy(); mounted.current = null;};
  }, [options.viewer, options.registry]);
  useEffect(() => {mounted.current?.update(options);});
  return createElement('div', {ref: host, className, 'data-markflow-overlay': 'signer-viewer'});
}
