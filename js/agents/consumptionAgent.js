// ============================================================
//  js/agents/consumptionAgent.js
//
//  AGENT 2 — CONSUMPTION AGENT
//  ────────────────────────────
//  Responsibility:
//    • Load household consumption multiplier from Firestore
//    • For each item, query the last 10 purchase history entries
//    • Calculate a weighted average weekly usage rate
//    • Scale by the household multiplier
//    • Estimate days left based on current stock + usage rate
//    • Write weeklyUsage + daysLeft back to each inventory item
//
//  Called by:
//    • runAgentPipeline() — step 2, receives items from InventoryAgent
//
//  Firestore reads:
//    • users/{userId}                          → consumptionMultiplier
//    • users/{userId}/purchaseHistory          → last 10 per item
//  Firestore writes:
//    • users/{userId}/inventory/{id}           → weeklyUsage, daysLeft
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { emitEvent } from "./core.js";

export const ConsumptionAgent = {
  name: "Consumption",

  /**
   * Recalculates weekly usage and days-left for every item.
   *
   * @param {string}   userId
   * @param {object[]} items   - Output from InventoryAgent.run()
   * @returns {object[]}       - Same items array with weeklyUsage + daysLeft added
   */
  async run(userId, items) {
    emitEvent(this.name, "active", "Analyzing consumption patterns…");

    try {
      // Load household multiplier set during onboarding
      const userSnap   = await getDoc(doc(db, "users", userId));
      const multiplier =
        userSnap.data()?.family?.consumptionMultiplier || 1;

      const updated = [];

      for (const item of items) {
        // ── Step 1: Fetch purchase history for this item ──
        const histQuery = query(
          collection(db, "users", userId, "purchaseHistory"),
          where("itemId", "==", item.id),
          orderBy("purchasedAt", "desc"),
          limit(10)
        );
        const histSnap = await getDocs(histQuery);
        const history  = histSnap.docs.map((d) => d.data());

        // ── Step 2: Calculate weekly usage ────────────────
        // Default: use the base rate from seed data × multiplier
        let weeklyUsage =
          (item.baseWeeklyUsage || item.weeklyUsage || 1) * multiplier;

        if (history.length >= 2) {
          const oldest = history[history.length - 1].purchasedAt?.toDate();
          const newest = history[0].purchasedAt?.toDate();
          const days   = oldest && newest
            ? Math.abs((newest - oldest) / 86_400_000)
            : 0;

          if (days > 0) {
            // Total qty purchased over the observed period
            const totalQty = history.reduce((sum, h) => sum + (h.qty || 1), 0);
            // Scale to weekly rate, then apply household multiplier
            weeklyUsage = (totalQty / days) * 7 * multiplier;
          }
        }

        // Round to 1 decimal place
        weeklyUsage = Math.round(weeklyUsage * 10) / 10;

        // ── Step 3: Estimate days left ─────────────────────
        // Formula: (stockPct% of totalQuantity) / dailyUsage
        const dailyRate = weeklyUsage / 7;
        const daysLeft  =
          dailyRate > 0
            ? Math.round(
                (item.stockPct / 100) *
                (item.totalQuantity || 10) /
                dailyRate
              )
            : 999; // Unknown — no usage data yet

        // ── Step 4: Persist to Firestore ──────────────────
        await updateDoc(
          doc(db, "users", userId, "inventory", item.id),
          { weeklyUsage, daysLeft }
        );

        updated.push({ ...item, weeklyUsage, daysLeft });
      }

      emitEvent(
        this.name,
        "done",
        `Rates updated for ${updated.length} items (×${multiplier} household)`,
        { updated, multiplier }
      );

      return updated;

    } catch (err) {
      emitEvent(this.name, "error", err.message);
      throw err;
    }
  },
};
