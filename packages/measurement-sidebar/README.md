# MarkFlow Measurement Sidebar

Measurement results panel, detailed rows, selection, navigation and host bridge.

Package: `@elvisreis/markflow-measurement-sidebar`, version 0.2.2. Source and release notes are available on GitHub. No license has been granted yet.

## Install

```sh
npm install @elvisreis/markflow-measurement-sidebar@0.2.2
```

## Public API

```ts
import {createMeasurementSidebarController} from '@elvisreis/markflow-measurement-sidebar';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Register the sidebar bridge before mounting and dispose the registration after unmount. The current bridge is a singleton; concurrent independent viewers require explicit host isolation.

## React / Vue

Import `MarkFlowMeasurementSidebar` from `@elvisreis/markflow-measurement-sidebar/react` or `@elvisreis/markflow-measurement-sidebar/vue` and pass `documentId`. Register the corresponding bridge from the package's native entry before mounting. SSR renders the host only; the panel mounts on the client.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
