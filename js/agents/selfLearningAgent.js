// ============================================================
//  js/agents/selfLearningAgent.js
//
//  AGENT 7 — SELF-LEARNING AGENT
//  ──────────────────────────────
//  Responsibility:
//    • Run once per week (scheduled from dashboard)
//    • For each inventory item, look at last 5 actual purchases
//    • Apply a recency-weighted moving average to update weeklyUsage
//    • Recent purchases count more than older ones
//    • Write improved weeklyUsage back to Firestore
//    • Track when the model was last updated (modelUpdatedAt)
//
//  Called by:
//    • dashboard.html — on a weekly schedule via scheduleWeeklyRun()
//    • Can also be triggered manually from Settings page
//
//  Firestore reads:
//    • users/{userId}/inventory          → all items
//    • users/{userId}/purchaseHistory    → last 5 per item
//  Firestore writes:
//    • users/{userId}/inventory/{id}     → weeklyUsage, modelUpdatedAt
//
//  Recency weights:
//    Most recent purchase:  35%
//    2nd most recent:       25%
//    3rd:                   20%
//    4th:                   12%
//    5th (oldest):           8%
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { emitEvent } from "./core.js";

// Recency weights — must sum to 1.0
const RECENCY_WEIGHTS = [0.35, 0.25, 0.20, 0.12, 0.08];

export const SelfLearningAgent = {
  name: "Learning",

  /**
   * Retrain consumption models for all items using real purchase data.
   *
   * @param {string} userId
   * @returns {{ improved: number }} - Number of items whose model was updated
   */
  async run(userId) {
    emitEvent(this.name, "active", "Retraining consumption models…");

    try {
      const invSnap  = await getDocs(
        collection(db, "users", userId, "inventory")
      );
      let improved   = 0;
      let unchanged  = 0;
      let skipped    = 0;

      for (const d of invSnap.docs) {
        const item = d.data();

        // ── Fetch last 5 purchases for this item ──────────
        const histQuery = query(
          collection(db, "users", userId, "purchaseHistory"),
          where("itemId", "==", d.id),
          orderBy("purchasedAt", "desc"),
          limit(5)
        );
        const histSnap = await getDocs(histQuery);
        const history  = histSnap.docs.map((h) => h.data());

        // Need at least 2 purchases to calculate a meaningful rate
        if (history.length < 2) {
          skipped++;
          continue;
        }

        // ── Recency-weighted moving average ────────────────
        let weightedSum  = 0;
        let weightTotal  = 0;

        history.forEach((purchase, index) => {
          const weight  = RECENCY_WEIGHTS[index] || 0.05;
          const qty     = purchase.qty || 1;
          weightedSum  += qty * weight;
          weightTotal  += weight;
        });

        // Convert to weekly rate
        const newWeeklyUsage =
          weightTotal > 0
            ? Math.round((weightedSum / weightTotal) * 7 * 10) / 10
            : item.weeklyUsage;

        // ── Only write if the model actually improved ──────
        const delta = Math.abs(newWeeklyUsage - (item.weeklyUsage || 0));

        if (delta > 0.1) {
          await updateDoc(
            doc(db, "users", userId, "inventory", d.id),
            {
              weeklyUsage:    newWeeklyUsage,
              modelUpdatedAt: serverTimestamp(),
            }
          );
          improved++;
        } else {
          unchanged++;
        }
      }

      const summary = `Retrained ${improved} models (${unchanged} unchanged, ${skipped} skipped)`;
      emitEvent(this.name, "done", summary, { improved, unchanged, skipped });

      return { improved, unchanged, skipped };

    } catch (err) {
      emitEvent(this.name, "error", err.message);
      throw err;
    }
  },

  // ── Weekly scheduler ──────────────────────────────────────
  /**
   * Schedule the agent to run every Sunday at midnight.
   * Call this once from dashboard.html after auth.
   *
   * @param {string} userId
   *
   * Usage:
   *   SelfLearningAgent.scheduleWeeklyRun(user.uid);
   */
  scheduleWeeklyRun(userId) {
    const now     = new Date();
    const nextRun = new Date(now);

    // Calculate ms until next Sunday midnight
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    nextRun.setDate(now.getDate() + daysUntilSunday);
    nextRun.setHours(0, 0, 0, 0);

    const msUntilFirst = nextRun - now;

    console.log(
      `[SelfLearningAgent] Next run scheduled in ${Math.round(msUntilFirst / 3_600_000)}h`
    );

    setTimeout(async () => {
      await this.run(userId);

      // Re-run every 7 days after that
      setInterval(() => this.run(userId), 7 * 24 * 3_600_000);

    }, msUntilFirst);
  },
};
