# Extension API catalog

Each component is a separately installable package. The common runtime lives in MarkFlow Core to preserve shared state, bridge registration and event coordination.

| Extension | Package | Public entry |
| --- | --- | --- |
| Zoom | `@elvispdosreis/markflow-zoom` | `mountViewerZoomControls` |
| Context Menu | `@elvispdosreis/markflow-context-menu` | `mountViewerContextMenu` |
| Measurements | `@elvispdosreis/markflow-measurements` | `MeasurementCalculator` |
| Calibration | `@elvispdosreis/markflow-calibration` | `CalibrationController` |
| Measurement Sidebar | `@elvispdosreis/markflow-measurement-sidebar` | `createMeasurementSidebarController` |
| Measurement Style | `@elvispdosreis/markflow-measurement-style` | `MeasurementStyleController` |
| Technical Comments | `@elvispdosreis/markflow-technical-comments` | `TechnicalCommentController` |
| Technical Comment Sidebar | `@elvispdosreis/markflow-technical-comment-sidebar` | `createTechnicalCommentSidebarController` |
| XFDF | `@elvispdosreis/markflow-xfdf` | `createXfdf` |
| Document Transfer | `@elvispdosreis/markflow-document-transfer` | `DocumentTransferController` |
| Modes | `@elvispdosreis/markflow-modes` | `ViewerModesController` |
| Command UI | `@elvispdosreis/markflow-command-ui` | `firstAvailableShortcut` |
| Crosshair Menu | `@elvispdosreis/markflow-crosshair-menu` | `registerViewerCrosshairMenu` |
| Guides Menu | `@elvispdosreis/markflow-guides-menu` | `registerViewerGuidesMenu` |
| Measurement Menu | `@elvispdosreis/markflow-measurement-menu` | `registerViewerMeasurementMenu` |
| Technical Comment Menu | `@elvispdosreis/markflow-technical-comment-menu` | `registerViewerTechnicalCommentMenu` |

## Zoom

20 percentage point zoom controls, Ctrl/Cmd keyboard shortcuts and wheel handling inside the active viewer.

Call the returned cleanup function before remounting and on host unmount.

Implementation and exported interfaces:
- [viewer-zoom-controls](../packages/core/src/features/viewer-extensions/viewer-zoom-controls.ts)

## Context Menu

Right-click quick actions with fixed drag/pointer modes and five recent tools per document.

Call the returned cleanup function on host unmount. The host provides EmbedPDF capabilities and UI state.

Implementation and exported interfaces:
- [viewer-context-menu](../packages/core/src/features/viewer-extensions/viewer-context-menu.ts)

## Measurements

Distance, perimeter, polygon area, rectangle area, ellipse and arc tools with geometry, results, history, selection and appearance controllers.

The host forwards annotation events and capabilities. Dispose interaction, highlight and loading controllers when their session ends. State and tool registration do not automatically subscribe to the viewer.

Implementation and exported interfaces:
- [measurement-tools](../packages/core/src/features/measurement/measurement-tools.ts)
- [measurement-command-definitions](../packages/core/src/features/measurement/measurement-command-definitions.ts)
- [measurement-calculator](../packages/core/src/features/measurement/measurement-calculator.ts)
- [measurement-record](../packages/core/src/features/measurement/measurement-record.ts)
- [measurement-state](../packages/core/src/features/measurement/measurement-state.ts)
- [measurement-history](../packages/core/src/features/measurement/measurement-history.ts)
- [measurement-appearance-controller](../packages/core/src/features/measurement/measurement-appearance-controller.ts)
- [measurement-events-controller](../packages/core/src/features/measurement/measurement-events-controller.ts)
- [measurement-selection-controller](../packages/core/src/features/measurement/measurement-selection-controller.ts)
- [measurement-interaction](../packages/core/src/features/measurement/measurement-interaction.ts)
- [measurement-highlight-controller](../packages/core/src/features/measurement/measurement-highlight-controller.ts)
- [measurement-loading-controller](../packages/core/src/features/measurement/measurement-loading-controller.ts)
- [measurement-calibration](../packages/core/src/features/measurement/measurement-calibration.ts)
- [arc-measurement](../packages/core/src/features/measurement/arc-measurement.ts)
- [distance-measurement](../packages/core/src/features/measurement/distance-measurement.ts)
- [shape-measurement](../packages/core/src/features/measurement/shape-measurement.ts)
- [measurement-i18n](../packages/core/src/features/measurement/measurement-i18n.ts)
- [measurement-icons](../packages/core/src/features/measurement/measurement-icons.ts)

## Calibration

Preset and custom scales, units, precision, imported calibration and recalculated results.

Keep one controller per session. Apply draft changes explicitly; this package does not mount UI.

Implementation and exported interfaces:
- [calibration-controller](../packages/core/src/features/measurement/calibration-controller.ts)
- [measurement-calculator](../packages/core/src/features/measurement/measurement-calculator.ts)

## Measurement Sidebar

Measurement results panel, detailed rows, selection, navigation and host bridge.

Register the sidebar bridge before mounting and dispose the registration after unmount. The current bridge is a singleton; concurrent independent viewers require explicit host isolation.

Implementation and exported interfaces:
- [measurement-sidebar](../packages/core/src/features/measurement/measurement-sidebar.ts)
- [measurement-sidebar-controller](../packages/core/src/features/measurement/measurement-sidebar-controller.ts)
- [measurement-sidebar-bridge](../packages/core/src/features/measurement/measurement-sidebar-bridge.ts)
- [measurement-sidebar.models](../packages/core/src/features/measurement/measurement-sidebar.models.ts)

## Measurement Style

Measurement colors, stroke, fill patterns and style selection panel.

Register the style bridge before mounting and dispose it after unmount. The current bridge is a singleton; concurrent independent viewers require explicit host isolation.

Implementation and exported interfaces:
- [measurement-style-sidebar](../packages/core/src/features/measurement/measurement-style-sidebar.ts)
- [measurement-style-controller](../packages/core/src/features/measurement/measurement-style-controller.ts)
- [measurement-style-bridge](../packages/core/src/features/measurement/measurement-style-bridge.ts)
- [measurement-style.models](../packages/core/src/features/measurement/measurement-style.models.ts)
- [measurement-fill](../packages/core/src/features/measurement/measurement-fill.ts)

## Technical Comments

Numbered error, note, question and resolved comments with annotation tools and pin rendering.

Register capabilities and forward events from the host. Dispose the marker mount cleanup when the document/viewer unmounts.

Implementation and exported interfaces:
- [technical-comment.models](../packages/core/src/features/technical-comments/technical-comment.models.ts)
- [technical-comment-tool](../packages/core/src/features/technical-comments/technical-comment-tool.ts)
- [technical-comment-controller](../packages/core/src/features/technical-comments/technical-comment-controller.ts)
- [technical-comment-marker](../packages/core/src/features/technical-comments/technical-comment-marker.ts)
- [technical-comment-pin](../packages/core/src/features/technical-comments/technical-comment-pin.ts)
- [technical-comment-i18n](../packages/core/src/features/technical-comments/technical-comment-i18n.ts)
- [technical-comment-icons](../packages/core/src/features/technical-comments/technical-comment-icons.ts)

## Technical Comment Sidebar

Technical comment listing, selection, navigation and removal panel.

Register the sidebar bridge before mounting and dispose it after unmount. The current bridge is a singleton; concurrent independent viewers require explicit host isolation.

Implementation and exported interfaces:
- [technical-comment-sidebar](../packages/core/src/features/technical-comments/technical-comment-sidebar.ts)
- [technical-comment-sidebar-controller](../packages/core/src/features/technical-comments/technical-comment-sidebar-controller.ts)
- [technical-comment-sidebar-bridge](../packages/core/src/features/technical-comments/technical-comment-sidebar-bridge.ts)

## XFDF

MarkFlow XFDF import/export, Apryse adaptation, coordinate conversion and timed RLZ legacy compatibility.

Parsing requires DOMParser, and serialization/import uses browser XML APIs. Legacy RLZ imports are accepted only until 2027-10-06 00:00 America/Sao_Paulo; new files use markflow: and urn:markflow:xfdf:1. Legacy compatibility does not change annotation contents.

Implementation and exported interfaces:
- [xfdf-export](../packages/core/src/features/export/xfdf-export.ts)
- [xfdf-coordinates](../packages/core/src/features/export/xfdf-coordinates.ts)
- [apryse-xfdf-adapter](../packages/core/src/features/export/apryse-xfdf-adapter.ts)
- [xfdf-schema](../packages/core/src/features/export/xfdf-schema.ts)
- [xfdf-legacy-compatibility](../packages/core/src/features/export/xfdf-legacy-compatibility.ts)

## Document Transfer

Local XFDF transfer, PDF downloads and technical comment PDF appearances.

Provide annotation/export capabilities and callbacks. Call destroy() on session end to cancel deferred work and revoke temporary URLs. Downloads require browser DOM APIs.

Implementation and exported interfaces:
- [document-transfer-controller](../packages/core/src/features/export/document-transfer-controller.ts)
- [technical-comment-pdf](../packages/core/src/features/export/technical-comment-pdf.ts)

## Modes

Keyboard, drawing modes, deletion, crosshair state and measurement interaction coordination.

The host owns keyboard listeners, persistence and viewer capabilities. Forward keyboard and document events explicitly.

Implementation and exported interfaces:
- [viewer-modes-controller](../packages/core/src/features/viewer-extensions/viewer-modes-controller.ts)

## Command UI

Available shortcut selection and viewer toolbar composition.

Pure command/schema helpers. Keep schema ownership with the host viewer.

Implementation and exported interfaces:
- [viewer-command-ui](../packages/core/src/features/viewer-extensions/viewer-command-ui.ts)

## Crosshair Menu

Crosshair commands, shortcuts and full/simple crosshair menu.

Register after viewer capabilities exist. Commands and schema belong to the viewer and are destroyed with it; independent menu uninstallation is not supported.

Implementation and exported interfaces:
- [viewer-crosshair-menu](../packages/core/src/features/viewer-extensions/viewer-crosshair-menu.ts)

## Guides Menu

Ruler and guide commands, shortcuts and menu.

Register after viewer capabilities exist. Commands and schema belong to the viewer; independent menu uninstallation is not supported.

Implementation and exported interfaces:
- [viewer-guides-menu](../packages/core/src/features/viewer-extensions/viewer-guides-menu.ts)

## Measurement Menu

Measurement toolbar, panels, commands and UI events.

Call the returned cleanup to unsubscribe toolbar events. Commands and schema remain owned by the viewer; cleanup does not uninstall the schema.

Implementation and exported interfaces:
- [viewer-measurement-menu](../packages/core/src/features/viewer-extensions/viewer-measurement-menu.ts)

## Technical Comment Menu

Technical comment tool command and panel menu.

Register after capabilities exist. Commands and schema remain owned by the viewer and are destroyed with it.

Implementation and exported interfaces:
- [viewer-technical-comment-menu](../packages/core/src/features/viewer-extensions/viewer-technical-comment-menu.ts)
