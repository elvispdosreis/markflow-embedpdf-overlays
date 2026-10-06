import {mountViewerZoomControls} from '@elvisreis/markflow-zoom';
import {mountViewerContextMenu} from '@elvisreis/markflow-context-menu';
import {MeasurementCalculator, measurementRecord} from '@elvisreis/markflow-measurements';
import {CalibrationController} from '@elvisreis/markflow-calibration';
import {createMeasurementSidebarController} from '@elvisreis/markflow-measurement-sidebar';
import {MeasurementStyleController} from '@elvisreis/markflow-measurement-style';
import {TechnicalCommentController} from '@elvisreis/markflow-technical-comments';
import {createTechnicalCommentSidebarController} from '@elvisreis/markflow-technical-comment-sidebar';
import {createXfdf, parseXfdf} from '@elvisreis/markflow-xfdf';
import {DocumentTransferController} from '@elvisreis/markflow-document-transfer';
import {ViewerModesController} from '@elvisreis/markflow-modes';
import {firstAvailableShortcut} from '@elvisreis/markflow-command-ui';
import {registerViewerCrosshairMenu} from '@elvisreis/markflow-crosshair-menu';
import {registerViewerGuidesMenu} from '@elvisreis/markflow-guides-menu';
import {registerViewerMeasurementMenu} from '@elvisreis/markflow-measurement-menu';
import {registerViewerTechnicalCommentMenu} from '@elvisreis/markflow-technical-comment-menu';
import {MarkFlowMeasurementSidebar} from '@elvisreis/markflow-measurement-sidebar/react';
import {MarkFlowMeasurementStyle} from '@elvisreis/markflow-measurement-style/react';
import {MarkFlowTechnicalCommentSidebar} from '@elvisreis/markflow-technical-comment-sidebar/react';
import {MarkFlowMeasurementSidebar as VueSidebar} from '@elvisreis/markflow-measurement-sidebar/vue';
import {MarkFlowMeasurementStyle as VueStyle} from '@elvisreis/markflow-measurement-style/vue';
import {MarkFlowTechnicalCommentSidebar as VueComments} from '@elvisreis/markflow-technical-comment-sidebar/vue';
export const calibration = new CalibrationController(new MeasurementCalculator());
export const functions = [mountViewerZoomControls, mountViewerContextMenu, measurementRecord, createMeasurementSidebarController,
  MeasurementStyleController, TechnicalCommentController, createTechnicalCommentSidebarController, createXfdf, parseXfdf,
  DocumentTransferController, ViewerModesController, firstAvailableShortcut, registerViewerCrosshairMenu,
  registerViewerGuidesMenu, registerViewerMeasurementMenu, registerViewerTechnicalCommentMenu];
export const panels = <><MarkFlowMeasurementSidebar documentId="doc"/><MarkFlowMeasurementStyle documentId="doc"/><MarkFlowTechnicalCommentSidebar documentId="doc"/></>;
export const vuePanels = [VueSidebar, VueStyle, VueComments];
