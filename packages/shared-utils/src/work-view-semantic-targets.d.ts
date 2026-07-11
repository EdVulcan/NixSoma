import type { WorkViewSemanticTargetInventory } from "@openclaw/shared-types/screen";

export type { WorkViewSemanticTargetInventory } from "@openclaw/shared-types/screen";

export declare const WORK_VIEW_SEMANTIC_TARGET_INVENTORY_REGISTRY: "openclaw-browser-semantic-target-inventory-v0";
export declare const WORK_VIEW_SEMANTIC_TARGET_MAX_ITEMS: 64;
export declare const WORK_VIEW_SEMANTIC_TARGET_MAX_NAME_CHARS: 120;

export declare function unavailableWorkViewSemanticTargets(reason: string): WorkViewSemanticTargetInventory;
export declare function projectWorkViewSemanticTargets(inventory: unknown): WorkViewSemanticTargetInventory;
export declare function summariseWorkViewSemanticTargets(
  inventory: unknown,
): Omit<WorkViewSemanticTargetInventory, "items">;
