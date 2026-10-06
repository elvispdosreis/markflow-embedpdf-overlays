import type {GuideOrientation} from './guides-state';

export const GUIDE_RULER_SIZE = 28;

export interface GuideDragActivity {
  readonly pageIndex: number;
  readonly orientation: GuideOrientation;
  readonly position: number;
  readonly removing: boolean;
}

export interface GuideViewportOffset {
  readonly left: number;
  readonly top: number;
}
