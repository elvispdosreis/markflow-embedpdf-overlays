# MarkFlow Measurement Menu

Measurement toolbar, panels, commands and UI events.

Package: `@elvisreis/markflow-measurement-menu`, version 0.2.1. Source and release notes are available on GitHub. No license has been granted yet.

## Install

```sh
npm install @elvisreis/markflow-measurement-menu@0.2.1
```

## Public API

```ts
import {registerViewerMeasurementMenu} from '@elvisreis/markflow-measurement-menu';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Call the returned cleanup to unsubscribe toolbar events. Commands and schema remain owned by the viewer; cleanup does not uninstall the schema.

## React / Vue

This package exports framework-independent functions and controllers. Call them from React effects or Vue lifecycle hooks, forwarding viewer capabilities and host callbacks. It does not add a framework-specific visual component.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
