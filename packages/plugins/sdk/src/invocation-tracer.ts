import { AsyncLocalStorage } from "node:async_hooks";
import type { PluginSpanRecord } from "./protocol.js";

// One bounded receipt per invocation; children never select their host parent.
export function createInvocationTracer(
  enabled: () => boolean,
  record: (span: PluginSpanRecord) => void,
) {
  type Scope = { span: PluginSpanRecord; budget: { remaining: number }; closed: boolean };
  const active = new AsyncLocalStorage<Scope>();
  async function withSpan<T>(name: string, work: () => T | Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T> {
    if (!enabled()) return work();
    const parent = active.getStore();
    // Detached work cannot outlive or inherit a completed invocation receipt.
    if (parent?.closed) return work();
    const budget = parent?.budget ?? { remaining: 256 };
    if (budget.remaining-- <= 0) return work();
    const startTimeMs = Date.now(), started = performance.now();
    const span: PluginSpanRecord = { name, startTimeMs, attributes, children: [] };
    const scope: Scope = { span, budget, closed: false };
    parent?.span.children?.push(span);
    try { return await active.run(scope, work); }
    catch (error) { span.status = { code: 2 }; throw error; }
    finally {
      scope.closed = true;
      span.endTimeMs = startTimeMs + Math.max(0, performance.now() - started);
      if (!parent) { try { record(span); } catch {} }
    }
  }
  return {
    withSpan,
    isRecording: enabled,
    recordSpan(span: PluginSpanRecord): boolean {
      const scope = active.getStore();
      if (!enabled() || !scope || scope.closed || scope.budget.remaining-- <= 0) return false;
      scope.span.children?.push(span);
      return true;
    },
  };
}
