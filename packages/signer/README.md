# MarkFlow Signer

`@elvisreis/markflow-signer` positions a signature area over EmbedPDF 2.15.0 and returns signing coordinates. It uses a built-in HTML box inspired by the [user's signer-box reference](https://stackblitz.com/edit/angular-17-dragdrop-thq7pu-xnugdh?file=src%2Fapp%2Fapp.component.css): white background, dashed border, orange glow and Portuguese guidance. No external SVG or signature image is loaded.

The box is a preview layer: it does not modify the PDF, embed a stamp, sign cryptographically, or connect to gov.br. The application supplies its signing service and calls it after an explicit confirmation.

## APIs

| API | Use |
| --- | --- |
| `SignerState` | One shared selection for the viewer session; `subscribe`, `getSelection`, `select`, `rotate`, `setRotation`, `clear`, `setEnabled`, `confirm`, `close`, `destroy` |
| `createSignerContext(registry)` | Read active document/page geometry through public EmbedPDF capabilities |
| `mountSignerViewer(host, options)` | Full snippet viewer overlay, with scrolling, zoom, rotation, page virtualization and cross-page dragging; returns `moveToPage(pageIndex)` |
| `mountSigner(host, options)` | A single page layer for a headless viewer |
| `registerSignerViewerElement()` | Angular-compatible `<markflow-signer-viewer [options]="options">` |
| `registerSignerElement()` | Angular-compatible `<markflow-signer [options]="options">` per-page layer |
| `/react` | `MarkFlowSignerViewer`, `MarkFlowSigner` |
| `/vue` | `MarkFlowSignerViewer`, `MarkFlowSigner` |
| `signatureCoordinates(rect, page)` | Pure conversion matching `StampCoordinates` |
| `createNativeThumbnailDropTarget(viewer, registry)` | Hit-test the native EmbedPDF thumbnail pane through its public virtual window |

Version `0.1.0` is implemented here; publish/install the local package before using the npm import names below. React and Vue are optional peers. Angular uses the Web Component with `CUSTOM_ELEMENTS_SCHEMA`, without a dependency on a specific Angular version. SSR can import the package; mounting and custom-element registration happen on the client.

## Initial position from the bottom-right corner

Pass `initialPosition` in the same options used by Angular, React, Vue or the native mount:

```ts
const options = {
  viewer, registry, state,
  initialPosition: {x: 40, y: 60, pageIndex: 0}
};
mountSignerViewer(host, options);
```

To explicitly apply a position again after dragging or removing the box, call `mounted.setPosition({x: 40, y: 60, pageIndex: 0})`. It returns `true` on success and reveals the destination; invalid coordinates preserve the current selection. The demo's **Testar posição inicial** button next to **Remover caixa** exercises this API.

`x` is the gap between the signing box's right edge and the page's right edge. `y` is the gap between its bottom edge and the page's bottom edge. Values use PDF points (1/72 inch), matching `coordinates.margin.right` and `coordinates.margin.bottom`, and reference the page's intrinsic PDF orientation. Zoom and temporary viewer rotation do not change these margins. `pageIndex` is zero-based and defaults to 0. The viewer initializes and reveals the specified page even when it was not initially visible. Placement happens once per document; subsequent dragging, removal and remounting do not reset the user's position. `autoPlace: false` disables initialization. Invalid, negative or out-of-page coordinates leave the box unplaced. For a single-page `mountSigner`, pass the same option on the requested page layer.

## Native EmbedPDF snippet

Create a positioned frame containing the viewer target and a sibling overlay host. Both must cover the same full viewer rectangle. The extension clips itself to the PDF viewport, leaving the native toolbars and menus accessible. Do not mount over an iframe.

```html
<div style="position:relative;height:640px">
  <div id="viewer" style="height:100%"></div>
  <div id="signer" style="position:absolute;inset:0;pointer-events:none"></div>
</div>
```

```ts
import EmbedPDF from '@embedpdf/snippet';
import {SignerState, mountSignerViewer} from '@elvisreis/markflow-signer';

const viewer = EmbedPDF.init({type: 'container', target: document.querySelector('#viewer')!, src: '/example.pdf'});
if (!viewer) throw new Error('Viewer initialization failed');
const registry = await viewer.registry;
const state = new SignerState();
const mounted = mountSignerViewer(document.querySelector<HTMLElement>('#signer')!, {viewer, registry, state});

// In the application's explicit Sign button handler:
const request = state.confirm(mounted.context);
// request === null means no valid active selection. Supply your own service here.
// The application receives request.coordinates, request.rect and request.pdfRect.

// When the viewer session ends:
mounted.destroy();
state.destroy();
```

The box appears on the first visible page and has a fixed size by default. Navigation and background clicks preserve the existing signature; drag the box to move or transfer it between pages. Once removed, clicking a page creates the box there. Dragging near the viewport's top/bottom edges scrolls the document while preserving the pointer capture. Arrow keys move one point, Shift+arrow moves ten points, Escape/Delete removes the box. `autoPlace: false` waits for a click; resizing is an explicit opt-in with `resizable: true`. `size` defaults to `{width: 201.99, height: 55.0882}` in PDF points. `title` and `description` customize the text. `state.setEnabled(false)` hides the layer and releases page interaction. Scroll and pinch gestures should use the viewer while placement is paused on touch devices.

The example uses EmbedPDF's native thumbnail sidebar. Its clicks only navigate. Set `pageDropTarget: createNativeThumbnailDropTarget(viewer, registry)` in viewer options to show a miniature signature while dragging over a thumbnail. A persistent, draggable miniature also appears on the selected page thumbnail and follows the signature position and rotation. Drag either the document box or this miniature to another thumbnail or to the document viewport to move between pages. The preview follows the grab point and the destination page's intrinsic orientation. Releasing transfers the box to exactly that preview location (clamped to the page), preserves its actual dimensions and signature angle in PDF space, then scrolls to it. Leaving or cancelling removes the preview without transferring the signature. The helper targets the native `sidebar-panel` (or a custom schema ID passed as its third argument), renders no sidebar, and uses the public thumbnail virtual window plus the pane geometry of EmbedPDF 2.15.0. A custom sidebar can return `{pageIndex, bounds: {left, top, width, height}, rotation?}` for the same preview and placement behavior; bounds describe its actual page bitmap in client pixels and rotation defaults to the intrinsic PDF quarter turn. A custom resolver may expose getPageTarget(pageIndex) to enable its persistent draggable miniature; this returns the same bounds object, optionally with clipBounds for its visible pane. Returning only a page index retains the original transfer behavior without a miniature preview.

`mounted.moveToPage(pageIndex)` remains available for an explicit transfer action; do not attach it to normal thumbnail navigation. It preserves the actual signature dimensions and PDF angle, follows the destination page orientation, clamps the location and scrolls to its center. Pass `false` as the second argument to move without scrolling. Single-page headless mounts can implement the optional `onDrag` adapter to coordinate their own multi-page layout; the adapter receives the drag phase and displayed signature angle.

The signing box includes the same curved-arrow icon as EmbedPDF's annotation rotation handle. Drag the handle around the box center to rotate, with an angle tooltip and alignment axes; angles snap in 22.5-degree increments. Clicking or activating the button with the keyboard advances one increment. The handle stays upright and keeps a usable screen size at different zoom levels. To rotate programmatically, call `state.rotate(context)` (pass `-1` for counterclockwise) or `state.setRotation(context, degrees)` for an absolute snapped angle. The true signature dimensions remain fixed while its enclosing rectangle changes. Rotation keeps the center where possible and clamps to page edges; it returns `false` if the rotated fixed box cannot fit. Page/viewer rotation is unchanged. Dropping on a native thumbnail transfers the signature at the preview location, follows the destination page orientation and reveals it. Direct page-to-page dragging and the programmatic moveToPage helper also follow the destination page orientation while preserving the signature angle in PDF space.

Keep one state per viewer, share it between all page mounts, and keep options/state outside Vue deep proxies. Destroy each mount on unmount; do not destroy shared state when only a virtualized page disappears. The viewer integration clears state on document closure and refuses to confirm a selection from an inactive document. When using the per-page API without mounts, call `state.close(documentId)` from your own document lifecycle.

## React

For the snippet, render the viewer host and the following overlay in the same positioned frame. Construct options after `viewer.registry` resolves; keep `state` stable for the viewer session.

```tsx
import {MarkFlowSignerViewer} from '@elvisreis/markflow-signer/react';

<MarkFlowSignerViewer options={{viewer, registry, state}} />
```

For a headless viewer, mount `MarkFlowSigner` alongside `RenderLayer` **inside** EmbedPDF's `Rotate` component and the page-sized positioned container. The default `hostSpace: 'page'` expects that unrotated page coordinate space. It compensates for the outer rotation and aligns the label with the area's long edge. An overlay placed outside `Rotate`, over the already rotated page bounds, needs `hostSpace: 'rotated-page'`. Do not apply another rotation to that host. See [EmbedPDF's page rotation layout](https://www.embedpdf.com/docs/react/headless/plugins/plugin-rotate).

```tsx
import {MarkFlowSigner} from '@elvisreis/markflow-signer/react';

<Rotate documentId={documentId} pageIndex={pageIndex}>
  <PagePointerProvider documentId={documentId} pageIndex={pageIndex}>
    <RenderLayer documentId={documentId} pageIndex={pageIndex} />
    <MarkFlowSigner options={{state, context, documentId, pageIndex}} />
  </PagePointerProvider>
</Rotate>
```

The host must cover exactly one page, with no padding, border or skew. The extension derives zoom from its page bounds; pixels never enter the signing payload.

## Vue

```vue
<script setup lang="ts">
import {MarkFlowSignerViewer} from '@elvisreis/markflow-signer/vue';
import type {SignerViewerOptions} from '@elvisreis/markflow-signer';
defineProps<{options: SignerViewerOptions}>();
</script>
<template><MarkFlowSignerViewer :options="options" /></template>
```

For a headless viewer use `MarkFlowSigner` in the page slot, with the same layout contract as React. Create state with `markRaw(new SignerState())` or retain it in a `shallowRef`.

## Angular

Register the element on the client before showing it. Use property binding, not a serialized HTML attribute. After initializing the viewer, set `options` to `{viewer, registry, state}`.

```ts
import {Component, CUSTOM_ELEMENTS_SCHEMA, Input} from '@angular/core';
import {registerSignerViewerElement, type SignerViewerOptions} from '@elvisreis/markflow-signer';

@Component({
  selector: 'app-signature-overlay',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: '<markflow-signer-viewer [options]="options"></markflow-signer-viewer>'
})
export class SignatureOverlay {
  @Input() options: SignerViewerOptions | undefined;
  constructor() {registerSignerViewerElement();}
}
```

The element disconnect lifecycle destroys the mounted overlay. Keep this component in the same positioned frame as the viewer; the parent supplies options after the registry is ready, keeps a stable `SignerState`, and calls `state.destroy()` when the session ends. `registerSignerElement()` similarly provides the per-page element. Call `state.confirm(context)` from your application button after creating a non-null context with `createSignerContext(registry)`.

## Signing payload

```json
{
  "documentId": "example",
  "pageIndex": 0,
  "rotation": 0,
  "signatureRotation": 0,
  "signatureSize": {"width": 202, "height": 55},
  "rect": {"origin": {"x": 40, "y": 50}, "size": {"width": 202, "height": 55}},
  "coordinates": {
    "margin": {"right": 358, "bottom": 695},
    "image": {"width": 202, "height": 55},
    "page": {"number": 1, "width": 600, "height": 800, "rotation": 0}
  },
  "pdfRect": {"x": 40, "y": 695, "width": 202, "height": 55}
}
```

`rect` uses unrotated top-left page coordinates. `pdfRect` uses unrotated bottom-left page coordinates and full floating-point precision. `rotation` is the signature's clockwise quarter turns in unrotated PDF space; `signatureRotation` is the same angle in degrees, snapped to 22.5-degree increments. Fractional quarter turns are supported (`rotation: 0.25` means 22.5°). `signatureSize` contains the actual box dimensions before signature rotation; `rect` and `pdfRect` enclose the rotated box. The backend should use `signatureSize` and `signatureRotation` to draw the signature about the enclosing rectangle center. The backend must apply that signature orientation independently of `coordinates.page.rotation`. `coordinates` uses the page's intrinsic PDF rotation and rounds each dimension/margin exactly like `StampCoordinates`; its `image` name exists for compatibility even though no image is loaded. Page numbers are one-based; page indexes are zero-based. All units are PDF points (1/72 inch). Temporary viewer rotation only affects display and never changes the signing contract. Invalid, negative, non-finite or out-of-page geometry returns `null`.

## Local demonstration

The viewer integration follows EmbedPDF's interaction mode. In native hand/pan mode the page background passes input to the viewer, while hovering the signature box gives the move cursor and allows dragging or rotating it directly. Native thumbnail signatures remain draggable too. Returning to pointer mode restores background placement without changing the signature position. Low-level page mounts can use `boxOnly: true` for this behavior or `interactive: false` to release all input while keeping the signature visible.

### Prepared signature fields

`await mounted.moveToSignatureField('elvisreis')` finds an empty AcroForm `/FT /Sig` widget by its exact `/T` field name, places the signature box in its full rectangle, and scrolls to it. This explicitly uses the reserved field's dimensions rather than the default fixed box size. It works on non-visible and intrinsically rotated pages and resets manual signature rotation to the field's PDF orientation. The native thumbnail updates too.

The result has `status: 'placed'`, `fieldName`, zero-based `pageIndex`, and `annotationId`, or a failure status (`not-found`, `ambiguous`, `not-signature`, `occupied`, `invalid-area`, `invalid-id`, `unavailable`, `cancelled`, `error`). Failure preserves the current placement. The confirmed payload includes `field: {name, annotationId}`; manual movement or rotation clears this association because the box no longer occupies the exact reserved field. The EmbedPDF form plugin must be registered; its editing toolbar can remain hidden. Changing the document/selection during lookup cancels the operation. A drawn rectangle or printed user name alone is not a named PDF form field. This method positions the placeholder; it does not write a cryptographic signature or modify the PDF field. Your signing service must validate field permissions and any existing cryptographic signature before signing.

```ts
const placement = await mounted.moveToSignatureField('elvisreis');
if (placement.status === 'placed') {
  const request = state.confirm(mounted.context);
  // Pass the selected field name/annotationId and coordinates to your signing integration.
}
```

The demo includes an empty `elvisreis` signature field on page 2 and an ID input with “Posicionar na área reservada”.

From the repository root, after `npm ci` and `npm run build`:

```sh
node examples/signer/serve.mjs
```

Open `http://127.0.0.1:4317`. It generates a public two-page sample, including a rotated page, and loads the local EmbedPDF engine. The signing UI has a fixed box, native thumbnail sidebar, signature rotation, zoom/pointer controls and a fullscreen button at the right. Thumbnail clicks only navigate; dropping the box onto one transfers the signature and reveals it. You can also open a local PDF; failed loads preserve the current document and selection. The confirmation displays the payload; it does not send documents or sign them. Demo/generated assets live under the ignored `.verification` directory.
