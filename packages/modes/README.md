# MarkFlow Modes

Keyboard, drawing modes, deletion, crosshair state and measurement interaction coordination.

Package: `@elvispdosreis/markflow-modes`, version 0.2.0. Source is published on GitHub; npm publication is pending. No license has been granted yet.

## Public API

```ts
import {ViewerModesController} from '@elvispdosreis/markflow-modes';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

The host owns keyboard listeners, persistence and viewer capabilities. Forward keyboard and document events explicitly.

## React / Vue

This package exports framework-independent functions and controllers. Call them from React effects or Vue lifecycle hooks, forwarding viewer capabilities and host callbacks. It does not add a framework-specific visual component.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
