import {mountViewerZoomControls} from '@elvispdosreis/markflow-zoom';
import {mountViewerContextMenu} from '@elvispdosreis/markflow-context-menu';
import {MeasurementCalculator, measurementRecord} from '@elvispdosreis/markflow-measurements';
import {CalibrationController} from '@elvispdosreis/markflow-calibration';
import {createMeasurementSidebarController} from '@elvispdosreis/markflow-measurement-sidebar';
import {MeasurementStyleController} from '@elvispdosreis/markflow-measurement-style';
import {TechnicalCommentController} from '@elvispdosreis/markflow-technical-comments';
import {createTechnicalCommentSidebarController} from '@elvispdosreis/markflow-technical-comment-sidebar';
import {createXfdf, parseXfdf} from '@elvispdosreis/markflow-xfdf';
import {DocumentTransferController} from '@elvispdosreis/markflow-document-transfer';
import {ViewerModesController} from '@elvispdosreis/markflow-modes';
import {firstAvailableShortcut} from '@elvispdosreis/markflow-command-ui';
import {registerViewerCrosshairMenu} from '@elvispdosreis/markflow-crosshair-menu';
import {registerViewerGuidesMenu} from '@elvispdosreis/markflow-guides-menu';
import {registerViewerMeasurementMenu} from '@elvispdosreis/markflow-measurement-menu';
import {registerViewerTechnicalCommentMenu} from '@elvispdosreis/markflow-technical-comment-menu';
import {MarkFlowMeasurementSidebar} from '@elvispdosreis/markflow-measurement-sidebar/react';
import {MarkFlowMeasurementStyle} from '@elvispdosreis/markflow-measurement-style/react';
import {MarkFlowTechnicalCommentSidebar} from '@elvispdosreis/markflow-technical-comment-sidebar/react';
import {MarkFlowMeasurementSidebar as VueSidebar} from '@elvispdosreis/markflow-measurement-sidebar/vue';
import {MarkFlowMeasurementStyle as VueStyle} from '@elvispdosreis/markflow-measurement-style/vue';
import {MarkFlowTechnicalCommentSidebar as VueComments} from '@elvispdosreis/markflow-technical-comment-sidebar/vue';
export const calibration = new CalibrationController(new MeasurementCalculator());
export const functions = [mountViewerZoomControls, mountViewerContextMenu, measurementRecord, createMeasurementSidebarController,
  MeasurementStyleController, TechnicalCommentController, createTechnicalCommentSidebarController, createXfdf, parseXfdf,
  DocumentTransferController, ViewerModesController, firstAvailableShortcut, registerViewerCrosshairMenu,
  registerViewerGuidesMenu, registerViewerMeasurementMenu, registerViewerTechnicalCommentMenu];
export const panels = <><MarkFlowMeasurementSidebar documentId="doc"/><MarkFlowMeasurementStyle documentId="doc"/><MarkFlowTechnicalCommentSidebar documentId="doc"/></>;
export const vuePanels = [VueSidebar, VueStyle, VueComments];
