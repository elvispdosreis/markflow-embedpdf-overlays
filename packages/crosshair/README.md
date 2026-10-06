# MarkFlow Crosshair

An independent crosshair extension for EmbedPDF 2.15.0, with native, React and Vue entry points.

## Install

The packages are prepared for npm, but **not published to npm yet**. For now, clone the GitHub repository and run `npm ci` and `npm run build`. Once published, install `@elvispdosreis/markflow-crosshair` with npm.

## React

```tsx
import {MarkFlowCrosshair} from '@elvispdosreis/markflow-crosshair/react';
// options comes from your viewer session; mount in its native overlay slot.
<MarkFlowCrosshair options={options} />
```

## Vue

```vue
<script setup lang="ts">
import {MarkFlowCrosshair} from '@elvispdosreis/markflow-crosshair/vue';
import type {OverlayViewDependencies} from '@elvispdosreis/markflow-crosshair';
defineProps<{options: OverlayViewDependencies}>();
</script>
<template><MarkFlowCrosshair :options="options" /></template>
```

## Native mounting

```ts
import {mountCrosshair} from '@elvispdosreis/markflow-crosshair';
const mounted = mountCrosshair(overlayHost, options);
mounted.update();
// Dispose when the host unmounts:
mounted.destroy();
```

See the repository README for context creation, shared session state and positioning. Each extension installs independently; MarkFlow Core is a shared runtime dependency. No license has been granted yet.
