// ============================================================
//  js/agents/core.js
//  Shared constants and event emitter used by ALL agents
// ============================================================

export const LOW_STOCK    = 20;   // % threshold → "low"
export const CRITICAL     = 10;   // % threshold → "critical"
export const REORDER_LEAD = 3;    // days before stockout → trigger reorder

/**
 * Broadcasts a custom DOM event so any page can react to agent activity.
 *
 * @param {string} agent   - Agent name e.g. "Inventory"
 * @param {string} status  - "active" | "done" | "waiting" | "error"
 * @param {string} message - Human-readable description
 * @param {object} data    - Optional payload (items, cartId, etc.)
 *
 * Usage on any page:
 *   window.addEventListener("agent-event", e => {
 *     const { agent, status, message, data } = e.detail;
 *   });
 */
export function emitEvent(agent, status, message, data = {}) {
  window.dispatchEvent(
    new CustomEvent("agent-event", {
      detail: { agent, status, message, data, ts: new Date().toISOString() }
    })
  );
  // Also log to console for debugging
  const icon = { active: "⚙️", done: "✅", waiting: "⏳", error: "❌" }[status] || "•";
  console.log(`${icon} [${agent}] ${message}`, data);
}
