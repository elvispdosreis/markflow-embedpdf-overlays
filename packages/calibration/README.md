# MarkFlow Calibration

Preset and custom scales, units, precision, imported calibration and recalculated results.

Package: `@elvisreis/markflow-calibration`, version 0.3.0. Source and release notes are available on GitHub. No license has been granted yet.

## Install

```sh
npm install @elvisreis/markflow-calibration@0.3.0
```

## Public API

```ts
import {CalibrationController} from '@elvisreis/markflow-calibration';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Keep one controller per session. New sessions start at an applied 1:100 scale.
Imported scales remain authoritative. Apply draft changes explicitly and discard
pending changes on Cancel.

## Integrated visual sidebar

The package exports `CalibrationSidebar`, `registerCalibrationSidebar`,
`registerCalibrationSidebarBridge`, `notifyCalibrationSidebar` and
`CALIBRATION_SIDEBAR_ID`. Register `CalibrationSidebar` as the EmbedPDF custom
component `markflow-calibration-sidebar`, then call `registerCalibrationSidebar(ui)`.
Connect a bridge with `snapshot(documentId)`, `update(documentId, patch)`,
`apply(documentId)` and `cancel(documentId)`; dispose the bridge registration on teardown.
Open the panel through `ui.forDocument(documentId).setActiveSidebar('left', 'main', CALIBRATION_SIDEBAR_ID)`.
Notify the sidebar after external/imported state changes.

The controls follow the native annotation-style panel. The package retains all
previous headless exports and the shared `markflow-core@0.2.2` runtime.

## React / Vue

Use `mountCalibrationSidebar(host, documentId, bridge)` from React effects, Vue
lifecycle hooks or Angular view initialization. It mounts the same visual element
without a framework-specific wrapper and returns `refresh()` and `dispose()`.
The host provides recalculation and persistence through the bridge callbacks.
The visual adapter uses Preact and EmbedPDF 2.15.0; it has no Angular dependency.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
