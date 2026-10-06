# MarkFlow Measurements

Distance, perimeter, polygon area, rectangle area, ellipse and arc tools with geometry, results, history, selection and appearance controllers.

Package: `@elvispdosreis/markflow-measurements`, version 0.2.0. Source is published on GitHub; npm publication is pending. No license has been granted yet.

## Public API

```ts
import {MeasurementCalculator} from '@elvispdosreis/markflow-measurements';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

The host forwards annotation events and capabilities. Dispose interaction, highlight and loading controllers when their session ends. State and tool registration do not automatically subscribe to the viewer.

## React / Vue

This package exports framework-independent functions and controllers. Call them from React effects or Vue lifecycle hooks, forwarding viewer capabilities and host callbacks. It does not add a framework-specific visual component.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
