import {registerIcons} from '@embedpdf/snippet';

export const MEASUREMENT_ICON_NAMES = {
  distance: 'measure-distance',
  perimeter: 'measure-perimeter',
  area: 'measure-area',
  rectangleArea: 'measure-rectangle-area',
  ellipse: 'measure-ellipse',
  arc: 'measure-arc',
  calibration: 'measure-calibration',
  sidebar: 'measurements-sidebar',
  undo: 'measure-undo',
  redo: 'measure-redo'
} as const;

const tablerOutlineIcon = (...paths: string[]) => ({
  viewBox: '0 0 24 24',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  paths: paths.map(d => ({
    d,
    stroke: 'currentColor' as const,
    fill: 'none' as const
  }))
});

// @tabler/icons 3.46.0 · SVGs da coleção outline.
const MEASUREMENT_ICONS = {
  [MEASUREMENT_ICON_NAMES.distance]: tablerOutlineIcon(
    'M19.875 12c.621 0 1.125 .512 1.125 1.143v5.714c0 .631 -.504 1.143 -1.125 1.143h-15.875a1 1 0 0 1 -1 -1v-5.857c0 -.631 .504 -1.143 1.125 -1.143h15.75',
    'M9 12v2',
    'M6 12v3',
    'M12 12v3',
    'M18 12v3',
    'M15 12v2',
    'M3 3v4',
    'M3 5h18',
    'M21 3v4'
  ),
  [MEASUREMENT_ICON_NAMES.perimeter]: tablerOutlineIcon(
    'M3 17h4v4h-4l0 -4',
    'M17 3h4v4h-4l0 -4',
    'M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5'
  ),
  [MEASUREMENT_ICON_NAMES.area]: tablerOutlineIcon(
    'M10 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M17 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M3 11a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M13 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M6.5 9.5l3.5 -3',
    'M14 5.5l3 1.5',
    'M18.5 10l-2.5 7',
    'M13.5 17.5l-7 -5'
  ),
  [MEASUREMENT_ICON_NAMES.rectangleArea]: tablerOutlineIcon(
    'M3 5h11',
    'M12 7l2 -2l-2 -2',
    'M5 3l-2 2l2 2',
    'M19 10v11',
    'M17 19l2 2l2 -2',
    'M21 12l-2 -2l-2 2',
    'M3 12a2 2 0 0 1 2 -2h7a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2l0 -7'
  ),
  [MEASUREMENT_ICON_NAMES.ellipse]: tablerOutlineIcon(
    'M6 12a6 9 0 1 0 12 0a6 9 0 1 0 -12 0'
  ),
  [MEASUREMENT_ICON_NAMES.arc]: tablerOutlineIcon(
    'M3 11a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2',
    'M17 11a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2',
    'M10 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2',
    'M10 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2',
    'M19 10a5 5 0 0 0 -5 -5',
    'M5 14a5 5 0 0 0 5 5',
    'M5 10a5 5 0 0 1 5 -5'
  ),
  [MEASUREMENT_ICON_NAMES.calibration]: tablerOutlineIcon(
    'M17 3l4 4l-14 14l-4 -4l14 -14',
    'M16 7l-1.5 -1.5',
    'M13 10l-1.5 -1.5',
    'M10 13l-1.5 -1.5',
    'M7 16l-1.5 -1.5'
  ),
  [MEASUREMENT_ICON_NAMES.sidebar]: tablerOutlineIcon(
    'M4 4h16v5h-16z',
    'M7 4v2',
    'M10 4v3',
    'M13 4v2',
    'M16 4v3',
    'M5 14h2',
    'M10 14h9',
    'M5 19h2',
    'M10 19h9'
  ),
  [MEASUREMENT_ICON_NAMES.undo]: tablerOutlineIcon(
    'M9 14l-4 -4l4 -4',
    'M5 10h11a4 4 0 1 1 0 8h-1'
  ),
  [MEASUREMENT_ICON_NAMES.redo]: tablerOutlineIcon(
    'M15 14l4 -4l-4 -4',
    'M19 10h-11a4 4 0 1 0 0 8h1'
  )
} satisfies Parameters<typeof registerIcons>[0];

export function registerMeasurementIcons(): void {
  registerIcons(MEASUREMENT_ICONS);
}
