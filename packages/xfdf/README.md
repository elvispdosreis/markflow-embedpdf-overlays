# MarkFlow XFDF

MarkFlow XFDF import/export, Apryse adaptation, coordinate conversion and timed RLZ legacy compatibility.

Package: `@elvisreis/markflow-xfdf`, version 0.2.1. Source and release notes are available on GitHub. No license has been granted yet.

## Install

```sh
npm install @elvisreis/markflow-xfdf@0.2.1
```

## Public API

```ts
import {createXfdf} from '@elvisreis/markflow-xfdf';
```

Use the exported option interfaces and callbacks to connect this extension to your host. The implementation and behavior tests are linked from the repository's [API catalog](../../docs/extensions.md).

## Lifecycle and limits

Parsing requires DOMParser, and serialization/import uses browser XML APIs. Legacy RLZ imports are accepted only until 2027-10-06 00:00 America/Sao_Paulo; new files use markflow: and urn:markflow:xfdf:1. Legacy compatibility does not change annotation contents.

## React / Vue

This package exports framework-independent functions and controllers. Call them from React effects or Vue lifecycle hooks, forwarding viewer capabilities and host callbacks. It does not add a framework-specific visual component.

## Development

From the repository root: `npm ci`, `npm run build`, `npm test`. Each extension is individually packaged and uses the common MarkFlow Core runtime. It has no Angular, approval stamp or application backend dependency.
