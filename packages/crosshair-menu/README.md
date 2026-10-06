# MarkFlow Crosshair Menu

Crosshair commands, shortcuts and full/simple crosshair menu.

Package: `@elvisreis/markflow-crosshair-menu`, version 0.2.1. Source and release notes are available on GitHub. No license has been granted yet.

## Install

```sh
npm install @elvisreis/markflow-crosshair-menu@0.2.1
```

## Public API

```ts
import {registerViewerCrosshairMenu} from '@elvisreis/markflow-crosshair-menu';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Register after viewer capabilities exist. Commands and schema belong to the viewer and are destroyed with it; independent menu uninstallation is not supported.

## React / Vue

This package exports framework-independent functions and controllers. Call them from React effects or Vue lifecycle hooks, forwarding viewer capabilities and host callbacks. It does not add a framework-specific visual component.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
