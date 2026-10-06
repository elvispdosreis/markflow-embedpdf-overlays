import {registerIcons} from '@embedpdf/snippet';

export const TECHNICAL_COMMENT_ICON_NAME = 'markflow-technical-comment';

export function registerTechnicalCommentIcons(): void {
  registerIcons({
    [TECHNICAL_COMMENT_ICON_NAME]: {
      viewBox: '0 0 24 24', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      paths: [
        {d: 'M5 4h14a2 2 0 0 1 2 2v11a2 2 0 0 1 -2 2h-9l-5 3v-3a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2', stroke: 'currentColor', fill: 'none'},
        {d: 'M8 9h8', stroke: 'currentColor', fill: 'none'},
        {d: 'M8 13h5', stroke: 'currentColor', fill: 'none'}
      ]
    }
  });
}
