export const CROSSHAIR_STYLES = `
    :host { position: absolute; inset: 0; z-index: 20; overflow: hidden; color: var(--color-markflow-500, #009ed7); }
    :host > svg { width: 100%; height: 100%; }
    svg { pointer-events: none; }
    svg[data-crosshair-viewport] { overflow: hidden; }
    line { stroke: currentColor; stroke-width: 1; opacity: .85; }
    @media print { :host { display: none !important; } }
  `;
export const GUIDES_STYLES = `
    :host { position: absolute; inset: 0; z-index: 19; overflow: hidden; pointer-events: none; color: #a855f7; }
    svg { width: 100%; height: 100%; pointer-events: none; }
    .hit-area { stroke: transparent; stroke-width: 6; }
    .guide-line { stroke: currentColor; stroke-width: 1; opacity: .88; }
    .selected { stroke: #c084fc; opacity: 1; }
    @media print { :host { display: none !important; } }
  `;
export const RULERS_STYLES = `
    :host { position: absolute; inset: 0; z-index: 22; pointer-events: none; user-select: none; color: #334155; font: 9px/1 system-ui, sans-serif; }
    .corner, .top-ruler, .left-ruler { position: absolute; pointer-events: auto; background: color-mix(in srgb, #f8fafc 94%, transparent); border-color: #cbd5e1; box-shadow: 0 1px 3px rgb(15 23 42 / .12); }
    .corner { width: 28px; height: 28px; border-right: 1px solid; border-bottom: 1px solid; display: grid; place-items: center; color: #0284c7; font-weight: 800; }
    .top-ruler { height: 28px; border-bottom: 1px solid; cursor: ns-resize; overflow: hidden; }
    .left-ruler { width: 28px; border-right: 1px solid; cursor: ew-resize; overflow: hidden; }
    .locked { cursor: not-allowed; }
    svg { width: 100%; height: 100%; overflow: hidden; }
    .tick { stroke: #64748b; stroke-width: 1; }
    .major { stroke: #334155; }
    text { fill: #334155; font-size: 9px; }
    .preview { stroke: #a855f7; stroke-width: 1; pointer-events: none; }
    .position { position: absolute; padding: 3px 5px; border-radius: 4px; color: white; background: #7e22ce; box-shadow: 0 1px 3px rgb(15 23 42 / .2); white-space: nowrap; }
    .position.horizontal { transform: translate(4px, -50%); }
    .position.vertical { transform: translate(-50%, -50%); }
    .position.removing { background: #dc2626; }
    .unit { position: absolute; right: 4px; top: 3px; padding: 2px 3px; color: #0369a1; background: rgb(240 249 255 / .9); border-radius: 3px; font-weight: 700; }
    @media print { :host { display: none !important; } }
  `;
