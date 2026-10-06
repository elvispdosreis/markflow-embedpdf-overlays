# MarkFlow Measurement Style

Measurement colors, stroke, fill patterns and style selection panel.

Package: `@elvisreis/markflow-measurement-style`, version 0.2.1. Source and release notes are available on GitHub. No license has been granted yet.

## Install

```sh
npm install @elvisreis/markflow-measurement-style@0.2.1
```

## Public API

```ts
import {MeasurementStyleController} from '@elvisreis/markflow-measurement-style';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Register the style bridge before mounting and dispose it after unmount. The current bridge is a singleton; concurrent independent viewers require explicit host isolation.

## React / Vue

Import `MarkFlowMeasurementStyle` from `@elvisreis/markflow-measurement-style/react` or `@elvisreis/markflow-measurement-style/vue` and pass `documentId`. Register the corresponding bridge from the package's native entry before mounting. SSR renders the host only; the panel mounts on the client.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
