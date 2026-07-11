export type FocusedWindow = {
  title: string;
  pid?: number;
};

export type OCRBlock = {
  text: string;
  confidence?: number;
};

export type ScreenReadiness = "ready" | "warming_up" | "degraded";

export type WorkViewVisualFrame = {
  registry: "openclaw-browser-visual-frame-v0";
  available: boolean;
  reason: string | null;
  sourceScope: "ai_owned_active_page_only";
  pageId?: string | null;
  pageUrl?: string | null;
  mediaType?: "image/jpeg";
  encoding?: "base64_data_url";
  width: 960;
  height: 540;
  byteLength: number | null;
  maxBytes: number;
  sha256?: string;
  capturedAt: string | null;
  sequence?: number;
  ageMs?: number;
  fresh?: boolean;
  desktopWideCapture: false;
  persisted: false;
  dataExposed: boolean;
  dataUrl?: string;
};

export type WorkViewSemanticTarget = {
  targetId: string;
  role: string;
  tag: string;
  name: string;
  inputType: string | null;
  disabled: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  visible: true;
  valueExposed: false;
  selectorExposed: false;
};

export type WorkViewSemanticTargetInventory = {
  registry: "openclaw-browser-semantic-target-inventory-v0";
  available: boolean;
  reason: string | null;
  sourceScope: "ai_owned_active_page_only";
  pageUrl?: string | null;
  frame: { sha256: string; sequence: number; capturedAt: string | null } | null;
  itemCount: number;
  truncated: boolean;
  maxItems: number;
  maxNameChars: number;
  items: WorkViewSemanticTarget[];
  inventorySha256: string | null;
  inputValuesExposed: false;
  selectorsExposed: false;
  arbitraryPageScript: false;
  mutation: false;
  desktopWideCapture: false;
  persisted: false;
};

export type ScreenState = {
  timestamp: string;
  snapshotPath: string | null;
  visualFrame?: WorkViewVisualFrame | null;
  semanticTargets?: WorkViewSemanticTargetInventory | null;
  focusedWindow?: FocusedWindow;
  windowList: FocusedWindow[];
  ocrBlocks: OCRBlock[];
  summary: string;
  readiness: ScreenReadiness;
};
