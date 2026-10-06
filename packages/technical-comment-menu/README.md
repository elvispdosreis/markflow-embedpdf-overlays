# MarkFlow Technical Comment Menu

Technical comment tool command and panel menu.

Package: `@elvispdosreis/markflow-technical-comment-menu`, version 0.2.0. Source is published on GitHub; npm publication is pending. No license has been granted yet.

## Public API

```ts
import {registerViewerTechnicalCommentMenu} from '@elvispdosreis/markflow-technical-comment-menu';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Register after capabilities exist. Commands and schema remain owned by the viewer and are destroyed with it.

## React / Vue

This package exports framework-independent functions and controllers. Call them from React effects or Vue lifecycle hooks, forwarding viewer capabilities and host callbacks. It does not add a framework-specific visual component.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
