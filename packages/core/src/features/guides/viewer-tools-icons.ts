import {registerIcons} from '@embedpdf/snippet';

export const VIEWER_TOOL_ICON_NAMES = {
  crosshair: 'markflow-crosshair',
  crosshairEnable: 'markflow-crosshair-enable',
  crosshairDisable: 'markflow-crosshair-disable',
  crosshairSmall: 'markflow-crosshair-small',
  crosshairFull: 'markflow-crosshair-full',
  guides: 'markflow-guides',
  guidesEnable: 'markflow-guides-enable',
  guidesDisable: 'markflow-guides-disable',
  guideHorizontal: 'markflow-guide-horizontal',
  guideVertical: 'markflow-guide-vertical',
  guidesVisible: 'markflow-guides-visible',
  guidesLocked: 'markflow-guides-locked',
  guidesClear: 'markflow-guides-clear',
  importXfdf: 'markflow-import-xfdf',
  exportXfdf: 'markflow-export-xfdf',
  downloadPdf: 'markflow-download-pdf',
  loadSavedAnnotations: 'markflow-load-saved-annotations',
  saveSavedAnnotations: 'markflow-save-saved-annotations',
  insertStamp: 'markflow-insert-stamp'
} as const;

const outlineIcon = (...paths: string[]) => ({
  viewBox: '0 0 24 24',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  paths: paths.map(d => ({d, stroke: 'currentColor' as const, fill: 'none' as const}))
});

const VIEWER_TOOL_ICONS = {
  [VIEWER_TOOL_ICON_NAMES.crosshair]: outlineIcon(
    'M4 12h16', 'M12 4v16', 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0'
  ),
  [VIEWER_TOOL_ICON_NAMES.crosshairEnable]: outlineIcon(
    'M4 12h16', 'M12 4v16', 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M17 5h4', 'M19 3v4'
  ),
  [VIEWER_TOOL_ICON_NAMES.crosshairDisable]: outlineIcon(
    'M4 12h16', 'M12 4v16', 'M8 12a4 4 0 0 0 6.8 2.9', 'M3 3l18 18'
  ),
  [VIEWER_TOOL_ICON_NAMES.crosshairSmall]: outlineIcon(
    'M9 12h6', 'M12 9v6', 'M7 7h2', 'M7 7v2', 'M17 7h-2', 'M17 7v2', 'M7 17h2', 'M7 17v-2', 'M17 17h-2', 'M17 17v-2'
  ),
  [VIEWER_TOOL_ICON_NAMES.crosshairFull]: outlineIcon(
    'M3 12h18', 'M12 3v18', 'M4 7v-3h3', 'M17 4h3v3', 'M20 17v3h-3', 'M7 20h-3v-3'
  ),
  [VIEWER_TOOL_ICON_NAMES.guides]: outlineIcon(
    'M4 7h16', 'M8 4v6', 'M4 17h16', 'M16 14v6'
  ),
  [VIEWER_TOOL_ICON_NAMES.guidesEnable]: outlineIcon(
    'M4 8h16', 'M8 5v6', 'M4 17h10', 'M18 15v6', 'M15 18h6'
  ),
  [VIEWER_TOOL_ICON_NAMES.guidesDisable]: outlineIcon(
    'M5 8h15', 'M8 5v3', 'M4 17h13', 'M16 14v2', 'M3 3l18 18'
  ),
  [VIEWER_TOOL_ICON_NAMES.guideHorizontal]: outlineIcon(
    'M4 12h16', 'M7 9l-3 3l3 3', 'M17 9l3 3l-3 3'
  ),
  [VIEWER_TOOL_ICON_NAMES.guideVertical]: outlineIcon(
    'M12 4v16', 'M9 7l3 -3l3 3', 'M9 17l3 3l3 -3'
  ),
  [VIEWER_TOOL_ICON_NAMES.guidesVisible]: outlineIcon(
    'M2 12s3.5 -6 10 -6s10 6 10 6s-3.5 6 -10 6s-10 -6 -10 -6',
    'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'
  ),
  [VIEWER_TOOL_ICON_NAMES.guidesLocked]: outlineIcon(
    'M6 10h12v10h-12z', 'M8 10v-3a4 4 0 0 1 8 0v3', 'M12 14v2'
  ),
  [VIEWER_TOOL_ICON_NAMES.guidesClear]: outlineIcon(
    'M4 7h16', 'M9 7v-3h6v3', 'M7 7l1 13h8l1 -13', 'M10 11v5', 'M14 11v5'
  ),
  [VIEWER_TOOL_ICON_NAMES.importXfdf]: outlineIcon(
    'M6 3h8l4 4v14h-12z', 'M14 3v5h5', 'M3 13h9', 'M8 9l4 4l-4 4'
  ),
  [VIEWER_TOOL_ICON_NAMES.exportXfdf]: outlineIcon(
    'M6 3h8l4 4v14h-12z', 'M14 3v5h5', 'M12 13h9', 'M16 9l-4 4l4 4'
  ),
  [VIEWER_TOOL_ICON_NAMES.downloadPdf]: outlineIcon(
    'M12 3v12', 'M8 11l4 4l4-4', 'M5 21h14'
  ),
  [VIEWER_TOOL_ICON_NAMES.loadSavedAnnotations]: outlineIcon(
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1H5a1 1 0 0 1 -1 -1V5a1 1 0 0 1 1 -1z',
    'M8 9h.01', 'M12 9h4', 'M8 15h.01', 'M12 15h4'
  ),
  [VIEWER_TOOL_ICON_NAMES.saveSavedAnnotations]: outlineIcon(
    'M4 4h13l3 3v13H4z', 'M7 4v6h9V4', 'M8 20v-6h8v6'
  ),
  [VIEWER_TOOL_ICON_NAMES.insertStamp]: outlineIcon(
    'M7.586 4.586a2 2 0 0 0 -1.414 -.586h-.172a2 2 0 0 0 -2 2v.172a2 2 0 0 0 .586 1.414a2 2 0 0 1 0 2.828a2 2 0 0 0 -.586 1.414v.344a2 2 0 0 0 .586 1.414a2 2 0 0 1 0 2.828a2 2 0 0 0 -.586 1.414v.172a2 2 0 0 0 2 2h.172a2 2 0 0 0 1.414 -.586a2 2 0 0 1 2.828 0a2 2 0 0 0 1.414 .586h.344a2 2 0 0 0 1.414 -.586a2 2 0 0 1 2.828 0a2 2 0 0 0 1.414 .586h.172a2 2 0 0 0 2 -2v-.172a2 2 0 0 0 -.586 -1.414a2 2 0 0 1 0 -2.828a2 2 0 0 0 .586 -1.414v-.344a2 2 0 0 0 -.586 -1.414a2 2 0 0 1 0 -2.828a2 2 0 0 0 .586 -1.414v-.172a2 2 0 0 0 -2 -2h-.172a2 2 0 0 0 -1.414 .586a2 2 0 0 1 -2.828 0a2 2 0 0 0 -1.414 -.586h-.344a2 2 0 0 0 -1.414 .586a2 2 0 0 1 -2.828 0',
    'M9 9h6v6H9z', 'M10 12l1.5 1.5L14 11'
  )
} satisfies Parameters<typeof registerIcons>[0];

export function registerViewerToolIcons(): void {
  registerIcons(VIEWER_TOOL_ICONS);
}
