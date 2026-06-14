// ============================================================
//  js/agents/predictionAgent.js
//
//  AGENT 3 — PREDICTION AGENT
//  ───────────────────────────
//  Responsibility:
//    • Use daysLeft (from ConsumptionAgent) to compute exact
//      stockout dates for every item
//    • Assign urgency: critical | high | normal
//    • Flag items that need reordering within REORDER_LEAD days
//    • Persist prediction object to each inventory item
//    • Fire browser push notifications for critical items
//
//  Called by:
//    • runAgentPipeline() — step 3, receives items from ConsumptionAgent
//
//  Firestore reads:   (none — uses items passed in memory)
//  Firestore writes:  users/{userId}/inventory/{id} → prediction{}
// ============================================================

import { db } from "../firebase-config.js";
import {
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { emitEvent, REORDER_LEAD } from "./core.js";

export const PredictionAgent = {
  name: "Prediction",

  /**
   * Predicts stockout dates and returns items that need reordering.
   *
   * @param {string}   userId
   * @param {object[]} items   - Output from ConsumptionAgent.run()
   * @returns {object[]}       - Items where daysLeft <= REORDER_LEAD
   *                            Each item has a `prediction` object attached.
   */
  async run(userId, items) {
    emitEvent(this.name, "active", "Running stockout predictions…");

    try {
      const needsReorder = [];

      for (const item of items) {
        const daysLeft = item.daysLeft ?? 999;

        // Calculate exact stockout date
        const stockoutDate = new Date();
        stockoutDate.setDate(stockoutDate.getDate() + daysLeft);

        // Assign urgency score
        const urgency =
          daysLeft <= 1 ? "critical" :
          daysLeft <= 3 ? "high"     : "normal";

        const prediction = {
          daysLeft,
          stockoutDate:  stockoutDate.toISOString(),
          needsReorder:  daysLeft <= REORDER_LEAD,
          urgency,
          calculatedAt:  new Date().toISOString(),
        };

        // Persist prediction to Firestore
        await updateDoc(
          doc(db, "users", userId, "inventory", item.id),
          { prediction }
        );

        // Flag for reorder if running low
        if (prediction.needsReorder) {
          needsReorder.push({ ...item, prediction });
          this._sendNotification(item.name, daysLeft, urgency);
        }
      }

      emitEvent(
        this.name,
        "done",
        `${needsReorder.length} item${needsReorder.length !== 1 ? "s" : ""} flagged for reorder`,
        { needsReorder }
      );

      return needsReorder;

    } catch (err) {
      emitEvent(this.name, "error", err.message);
      throw err;
    }
  },

  // ── Browser push notification ─────────────────────────────
  /**
   * Fires a browser notification if permission has been granted.
   * To request permission, call:
   *   Notification.requestPermission()
   * on page load (requires user gesture on some browsers).
   */
  _sendNotification(itemName, daysLeft, urgency) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const title =
      urgency === "critical"
        ? "⚠️ HomeAgent: Out of stock tomorrow!"
        : "📦 HomeAgent: Low stock alert";

    const body =
      daysLeft <= 0
        ? `${itemName} is out of stock!`
        : `${itemName} runs out in ~${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`;

    new Notification(title, { body, icon: "/favicon.ico" });
  },
};
