/**
 * Validates the router's {intent, params} against the catalog. This is the gate:
 * an unknown intent or off-allowlist param is rejected here, before any SQL runs.
 */
import { CATALOG } from "./catalog";
import { INTENT_NAMES, type IntentName, type RoutedQuery } from "./types";

export type ValidationResult =
  | { ok: true; intent: IntentName; params: unknown }
  | { ok: false; reason: string };

export function validateRouted(routed: unknown): ValidationResult {
  if (!routed || typeof routed !== "object") {
    return { ok: false, reason: "router returned no structured query" };
  }
  const { intent, params } = routed as Partial<RoutedQuery>;
  if (typeof intent !== "string" || !(INTENT_NAMES as readonly string[]).includes(intent)) {
    return { ok: false, reason: `unknown intent: ${String(intent)}` };
  }
  const def = CATALOG[intent as IntentName];
  const parsed = def.schema.safeParse(params ?? {});
  if (!parsed.success) {
    return { ok: false, reason: `invalid params for ${intent}: ${parsed.error.message}` };
  }
  return { ok: true, intent: intent as IntentName, params: parsed.data };
}
