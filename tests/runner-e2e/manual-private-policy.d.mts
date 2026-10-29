/** Typed boundary for the workflow's JavaScript entry point. */
export function manualEvidenceRouting(env: Readonly<Record<string, string | undefined>>): {
  retention: "recurring" | "actions" | "private";
  executionIds: string[];
};

export function authorizeManualCellRoute(
  retention: string | undefined,
  executionId: string,
  privateIds: string,
): "actions" | "private";
