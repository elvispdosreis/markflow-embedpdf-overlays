# MarkFlow EmbedPDF Extensions

Independent PDF tools for EmbedPDF 2.15.0, with native, React and Vue integrations. Each feature has its own npm package and public entry points.

| Extension | Package | React / Vue component |
| --- | --- | --- |
| Crosshair | `@elvisreis/markflow-crosshair` | `MarkFlowCrosshair` |
| Rulers | `@elvisreis/markflow-rulers` | `MarkFlowRulers` |
| Guides | `@elvisreis/markflow-guides` | `MarkFlowGuides` |

`@elvisreis/markflow-core` is a support dependency sharing rendering lifecycle, contexts and document state. It is not an additional feature extension. Each feature can be installed independently. Rulers and Guides work together when guide creation by dragging a ruler is desired.

## Additional individual extensions

- [MarkFlow Signer](packages/signer): `@elvisreis/markflow-signer` — signature placement for Angular, React and Vue (new local package, version 0.1.0).
- [MarkFlow Zoom](packages/zoom): `@elvisreis/markflow-zoom`
- [MarkFlow Context Menu](packages/context-menu): `@elvisreis/markflow-context-menu`
- [MarkFlow Measurements](packages/measurements): `@elvisreis/markflow-measurements`
- [MarkFlow Calibration](packages/calibration): `@elvisreis/markflow-calibration`
- [MarkFlow Measurement Sidebar](packages/measurement-sidebar): `@elvisreis/markflow-measurement-sidebar`
- [MarkFlow Measurement Style](packages/measurement-style): `@elvisreis/markflow-measurement-style`
- [MarkFlow Technical Comments](packages/technical-comments): `@elvisreis/markflow-technical-comments`
- [MarkFlow Technical Comment Sidebar](packages/technical-comment-sidebar): `@elvisreis/markflow-technical-comment-sidebar`
- [MarkFlow XFDF](packages/xfdf): `@elvisreis/markflow-xfdf`
- [MarkFlow Document Transfer](packages/document-transfer): `@elvisreis/markflow-document-transfer`
- [MarkFlow Modes](packages/modes): `@elvisreis/markflow-modes`
- [MarkFlow Command UI](packages/command-ui): `@elvisreis/markflow-command-ui`
- [MarkFlow Crosshair Menu](packages/crosshair-menu): `@elvisreis/markflow-crosshair-menu`
- [MarkFlow Guides Menu](packages/guides-menu): `@elvisreis/markflow-guides-menu`
- [MarkFlow Measurement Menu](packages/measurement-menu): `@elvisreis/markflow-measurement-menu`
- [MarkFlow Technical Comment Menu](packages/technical-comment-menu): `@elvisreis/markflow-technical-comment-menu`

## Status

Version **0.2.2**. All 19 feature extensions and the shared core are published on npm under `@elvisreis`. Source is published on GitHub. No license has been granted yet. Do not assume an open-source license from repository visibility.

Install individual features, for example:

```sh
npm install @elvisreis/markflow-zoom@0.2.2 @elvisreis/markflow-context-menu@0.2.2
```

This repository contains individually packaged overlays, zoom, context menu, measurements, calibration, panels, comments, XFDF transfer, keyboard modes and menu modules. Approval stamps, application backend integration, private documents and application-specific services are excluded. See the [extension catalog](docs/extensions.md) for every package, API and lifecycle limitation.

## Build and test

```sh
npm ci
npm run build
npm test
npm run pack:check
```

Node.js 22.12+ is required for development. React and Vue are optional peers: install only the framework your application uses. The tested adapters use React 19 and Vue 3.5. React 18 uses the same hooks API but has not been separately tested.

## Viewer session

Mount components in EmbedPDF's native overlay slots, or a positioned container matching the PDF viewport. Putting the components elsewhere on the page will not position them over the drawing. Initialize the viewer first, then create the shared session options:

```ts
import {createCrosshairContext, createGuidesContext, createOverlayOptions, GuidesState} from '@elvisreis/markflow-guides';
const crosshair = createCrosshairContext(viewerElement, registry);
if (!crosshair) throw new Error('Viewer capabilities are not ready');
const guides = createGuidesContext(crosshair, registry);
const state = new GuidesState();
state.setEnabled(true);
const options = createOverlayOptions({
  state, context: () => guides, crosshairContext: () => crosshair,
  crosshairEnabled: () => true,
  calibration: () => ({linearFactor: 0.02, unit: 'm', precision: 2})
});
```

Use the same state/options when combining Rulers and Guides. Calibration converts PDF points to real-world units; it is not the zoom percentage. Keep state for the viewer session and call `state.destroy()` when that session ends. Each adapter cleans up its own view on unmount; it does not destroy shared session state. SSR renders only the host element; initialize the viewer on the client. React changes require a re-render. Vue getters can read refs/computed; keep GuidesState outside deep proxies, for example with `markRaw`.

See each package README for React, Vue and native usage. The public style and element prefix is `markflow-`. The visual extensions do not parse XFDF. The separate `markflow-xfdf` extension writes `markflow:` metadata with namespace `urn:markflow:xfdf:1` and accepts legacy RLZ imports until 2027-10-06 00:00 America/Sao_Paulo.
