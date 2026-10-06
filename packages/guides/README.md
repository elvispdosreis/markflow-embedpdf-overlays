# MarkFlow Guides

An independent guides extension for EmbedPDF 2.15.0, with native, React and Vue entry points.

## Install

```sh
npm install @elvisreis/markflow-guides@0.2.1
```

## React

```tsx
import {MarkFlowGuides} from '@elvisreis/markflow-guides/react';
// options comes from your viewer session; mount in its native overlay slot.
<MarkFlowGuides options={options} />
```

## Vue

```vue
<script setup lang="ts">
import {MarkFlowGuides} from '@elvisreis/markflow-guides/vue';
import type {OverlayViewDependencies} from '@elvisreis/markflow-guides';
defineProps<{options: OverlayViewDependencies}>();
</script>
<template><MarkFlowGuides :options="options" /></template>
```

## Native mounting

```ts
import {mountGuides} from '@elvisreis/markflow-guides';
const mounted = mountGuides(overlayHost, options);
mounted.update();
// Dispose when the host unmounts:
mounted.destroy();
```

See the repository README for context creation, shared session state and positioning. Each extension installs independently; MarkFlow Core is a shared runtime dependency. No license has been granted yet.
