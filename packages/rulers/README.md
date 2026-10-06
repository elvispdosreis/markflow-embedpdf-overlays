# MarkFlow Rulers

An independent rulers extension for EmbedPDF 2.15.0, with native, React and Vue entry points.

## Install

The packages are prepared for npm, but **not published to npm yet**. For now, clone the GitHub repository and run `npm ci` and `npm run build`. Once published, install `@elvispdosreis/markflow-rulers` with npm.

## React

```tsx
import {MarkFlowRulers} from '@elvispdosreis/markflow-rulers/react';
// options comes from your viewer session; mount in its native overlay slot.
<MarkFlowRulers options={options} />
```

## Vue

```vue
<script setup lang="ts">
import {MarkFlowRulers} from '@elvispdosreis/markflow-rulers/vue';
import type {OverlayViewDependencies} from '@elvispdosreis/markflow-rulers';
defineProps<{options: OverlayViewDependencies}>();
</script>
<template><MarkFlowRulers :options="options" /></template>
```

## Native mounting

```ts
import {mountRulers} from '@elvispdosreis/markflow-rulers';
const mounted = mountRulers(overlayHost, options);
mounted.update();
// Dispose when the host unmounts:
mounted.destroy();
```

See the repository README for context creation, shared session state and positioning. Each extension installs independently; MarkFlow Core is a shared runtime dependency. No license has been granted yet.
