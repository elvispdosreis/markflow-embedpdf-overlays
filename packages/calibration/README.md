# MarkFlow Calibration

Preset and custom scales, units, precision, imported calibration and recalculated results.

Package: `@elvisreis/markflow-calibration`, version 0.2.1. Source and release notes are available on GitHub. No license has been granted yet.

## Install

```sh
npm install @elvisreis/markflow-calibration@0.2.1
```

## Public API

```ts
import {CalibrationController} from '@elvisreis/markflow-calibration';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Keep one controller per session. Apply draft changes explicitly; this package does not mount UI.

## React / Vue

This package exports framework-independent functions and controllers. Call them from React effects or Vue lifecycle hooks, forwarding viewer capabilities and host callbacks. It does not add a framework-specific visual component.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
