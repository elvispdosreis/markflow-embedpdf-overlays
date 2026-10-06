# MarkFlow Document Transfer

Local XFDF transfer, PDF downloads and technical comment PDF appearances.

Package: `@elvispdosreis/markflow-document-transfer`, version 0.2.0. Source is published on GitHub; npm publication is pending. No license has been granted yet.

## Public API

```ts
import {DocumentTransferController} from '@elvispdosreis/markflow-document-transfer';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Provide annotation/export capabilities and callbacks. Call destroy() on session end to cancel deferred work and revoke temporary URLs. Downloads require browser DOM APIs.

## React / Vue

This package exports framework-independent functions and controllers. Call them from React effects or Vue lifecycle hooks, forwarding viewer capabilities and host callbacks. It does not add a framework-specific visual component.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
