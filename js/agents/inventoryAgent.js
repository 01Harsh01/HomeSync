// ============================================================
//  js/agents/inventoryAgent.js
//
//  AGENT 1 — INVENTORY AGENT
//  ─────────────────────────
//  Responsibility:
//    • Read all inventory items from Firestore
//    • Recalculate status (ok / low / critical) based on stockPct
//    • Write status back if it changed
//    • Return full items array + flagged low-stock items
//
//  Called by:
//    • runAgentPipeline()  — first step of every pipeline run
//    • Receipt scanning    — call updateFromPurchase() when new
//                           receipt is detected
//
//  Firestore reads:   users/{userId}/inventory  (all docs)
//  Firestore writes:  users/{userId}/inventory/{id}  → status
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { emitEvent, LOW_STOCK, CRITICAL } from "./core.js";

export const InventoryAgent = {
  name: "Inventory",

  // ── Main run ──────────────────────────────────────────────
  /**
   * Scans the entire inventory for the user.
   * Updates status flags if they've changed.
   *
   * @param {string} userId
   * @returns {{ items: object[], low: object[] }}
   */
  async run(userId) {
    emitEvent(this.name, "active", "Scanning inventory…");

    try {
      const snap  = await getDocs(
        collection(db, "users", userId, "inventory")
      );
      const items = [];

      for (const d of snap.docs) {
        const item = { id: d.id, ...d.data() };

        // Determine status from stock percentage
        const status =
          item.stockPct <= CRITICAL  ? "critical" :
          item.stockPct <= LOW_STOCK ? "low"      : "ok";

        // Only write to Firestore if status actually changed
        if (item.status !== status) {
          await updateDoc(
            doc(db, "users", userId, "inventory", d.id),
            { status }
          );
          item.status = status;
        }

        items.push(item);
      }

      // Separate low/critical items for downstream agents
      const low = items.filter((i) => i.status !== "ok");

      emitEvent(
        this.name,
        "done",
        `Scanned ${items.length} items · ${low.length} need attention`,
        { items, low }
      );

      return { items, low };

    } catch (err) {
      emitEvent(this.name, "error", err.message);
      throw err;
    }
  },

  // ── Update from purchase receipt ──────────────────────────
  /**
   * Called whenever a new purchase is detected (receipt OCR,
   * bank SMS, or manual entry). Adds stock back for each item.
   *
   * @param {string} userId
   * @param {Array<{ itemId: string, qty: number, addPct: number, price: number }>} purchases
   */
  async updateFromPurchase(userId, purchases) {
    emitEvent(this.name, "active", "Processing purchase receipt…");

    try {
      for (const purchase of purchases) {
        const ref  = doc(db, "users", userId, "inventory", purchase.itemId);

        // Get current stock
        const { getDoc } = await import(
          "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
        );
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;

        const current    = snap.data();
        const newStockPct = Math.min(
          100,
          (current.stockPct || 0) + (purchase.addPct || 20)
        );
        const newStatus  =
          newStockPct <= CRITICAL  ? "critical" :
          newStockPct <= LOW_STOCK ? "low"      : "ok";

        await updateDoc(ref, {
          stockPct:        newStockPct,
          status:          newStatus,
          lastPurchased:   serverTimestamp(),
          lastPurchaseQty: purchase.qty,
          lastPrice:       purchase.price || current.lastPrice,
        });

        // Log to purchase history for Consumption + Learning agents
        await addDoc(
          collection(db, "users", userId, "purchaseHistory"),
          {
            itemId:      purchase.itemId,
            name:        current.name,
            qty:         purchase.qty,
            price:       purchase.price || current.estimatedPrice,
            purchasedAt: serverTimestamp(),
          }
        );
      }

      emitEvent(
        this.name,
        "done",
        `Updated ${purchases.length} items from receipt`
      );

    } catch (err) {
      emitEvent(this.name, "error", err.message);
      throw err;
    }
  },
};
