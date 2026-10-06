'use client';
import {createElement, useEffect, useRef, type ReactElement} from 'react';
import {mountOverlayView, type OverlayKind, type OverlayViewDependencies, type OverlayViewMount} from './index';
import {liveDependencies} from './live-dependencies';

export interface ViewerOverlayProps {
  kind: OverlayKind;
  options: OverlayViewDependencies;
  className?: string;
}

/** Mount inside the native viewer overlay slot, or an equivalent positioned viewer container. */
export function ViewerOverlay({kind, options, className}: ViewerOverlayProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef<OverlayViewMount | null>(null);
  const current = useRef(options);
  useEffect(() => {
    current.current = options;
    if (!host.current) return;
    const view = mountOverlayView(kind, host.current, liveDependencies(() => current.current));
    mounted.current = view;
    view.update();
    return () => {view.destroy(); if (mounted.current === view) mounted.current = null;};
  }, [kind, options.state]);
  useEffect(() => {current.current = options; mounted.current?.update();});
  return createElement('div', {ref: host, className, 'data-markflow-overlay': kind});
}

export type ViewerOverlayOptionsProps = Omit<ViewerOverlayProps, 'kind'>;
export function ViewerGuides(props: ViewerOverlayOptionsProps): ReactElement {
  return createElement(ViewerOverlay, {...props, kind: 'guides'});
}
export function ViewerRulers(props: ViewerOverlayOptionsProps): ReactElement {
  return createElement(ViewerOverlay, {...props, kind: 'rulers'});
}
export function ViewerCrosshair(props: ViewerOverlayOptionsProps): ReactElement {
  return createElement(ViewerOverlay, {...props, kind: 'crosshair'});
}
