# MarkFlow Rulers

An independent rulers extension for EmbedPDF 2.15.0, with native, React and Vue entry points.

## Install

```sh
npm install @elvisreis/markflow-rulers@0.2.2
```

## React

```tsx
import {MarkFlowRulers} from '@elvisreis/markflow-rulers/react';
// options comes from your viewer session; mount in its native overlay slot.
<MarkFlowRulers options={options} />
```

## Vue

```vue
<script setup lang="ts">
import {MarkFlowRulers} from '@elvisreis/markflow-rulers/vue';
import type {OverlayViewDependencies} from '@elvisreis/markflow-rulers';
defineProps<{options: OverlayViewDependencies}>();
</script>
<template><MarkFlowRulers :options="options" /></template>
```

## Native mounting

```ts
import {mountRulers} from '@elvisreis/markflow-rulers';
const mounted = mountRulers(overlayHost, options);
mounted.update();
// Dispose when the host unmounts:
mounted.destroy();
```

See the repository README for context creation, shared session state and positioning. Each extension installs independently; MarkFlow Core is a shared runtime dependency. No license has been granted yet.
