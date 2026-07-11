import type { WorkViewVisualFrame } from "@openclaw/shared-types/screen";

export type { WorkViewVisualFrame } from "@openclaw/shared-types/screen";

export declare const WORK_VIEW_VISUAL_FRAME_REGISTRY: "openclaw-browser-visual-frame-v0";
export declare const WORK_VIEW_VISUAL_FRAME_WIDTH: 960;
export declare const WORK_VIEW_VISUAL_FRAME_HEIGHT: 540;
export declare const WORK_VIEW_VISUAL_FRAME_MAX_BYTES: number;
export declare const WORK_VIEW_VISUAL_FRAME_FRESHNESS_MS: number;
export declare const WORK_VIEW_VISUAL_FRAME_MEDIA_TYPE: "image/jpeg";

export declare function unavailableWorkViewVisualFrame(
  reason: string,
  details?: { capturedAt?: string | null; byteLength?: number | null },
): WorkViewVisualFrame;

export declare function projectWorkViewVisualFrame(
  frame: unknown,
  options?: { includeData?: boolean; now?: number },
): WorkViewVisualFrame;
