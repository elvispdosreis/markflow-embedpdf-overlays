# MarkFlow Crosshair

An independent crosshair extension for EmbedPDF 2.15.0, with native, React and Vue entry points.

## Install

```sh
npm install @elvisreis/markflow-crosshair@0.2.2
```

## React

```tsx
import {MarkFlowCrosshair} from '@elvisreis/markflow-crosshair/react';
// options comes from your viewer session; mount in its native overlay slot.
<MarkFlowCrosshair options={options} />
```

## Vue

```vue
<script setup lang="ts">
import {MarkFlowCrosshair} from '@elvisreis/markflow-crosshair/vue';
import type {OverlayViewDependencies} from '@elvisreis/markflow-crosshair';
defineProps<{options: OverlayViewDependencies}>();
</script>
<template><MarkFlowCrosshair :options="options" /></template>
```

## Native mounting

```ts
import {mountCrosshair} from '@elvisreis/markflow-crosshair';
const mounted = mountCrosshair(overlayHost, options);
mounted.update();
// Dispose when the host unmounts:
mounted.destroy();
```

See the repository README for context creation, shared session state and positioning. Each extension installs independently; MarkFlow Core is a shared runtime dependency. No license has been granted yet.
