# MarkFlow Measurement Style

Measurement colors, stroke, fill patterns and style selection panel.

Package: `@elvispdosreis/markflow-measurement-style`, version 0.2.0. Source is published on GitHub; npm publication is pending. No license has been granted yet.

## Public API

```ts
import {MeasurementStyleController} from '@elvispdosreis/markflow-measurement-style';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Register the style bridge before mounting and dispose it after unmount. The current bridge is a singleton; concurrent independent viewers require explicit host isolation.

## React / Vue

Import `MarkFlowMeasurementStyle` from `@elvispdosreis/markflow-measurement-style/react` or `@elvispdosreis/markflow-measurement-style/vue` and pass `documentId`. Register the corresponding bridge from the package's native entry before mounting. SSR renders the host only; the panel mounts on the client.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
