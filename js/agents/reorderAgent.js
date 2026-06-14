// ============================================================
//  js/agents/reorderAgent.js
//
//  AGENT 4 — REORDER AGENT
//  ────────────────────────
//  Responsibility:
//    • Take the list of items that need reordering
//    • Load user's platform preference and per-order budget cap
//    • Sort items by urgency (critical → high → normal)
//    • Build an optimized cart that fits within budget
//    • Apply coupon savings (8% if subtotal ≥ ₹400)
//    • Save the cart to Firestore with status "pending_approval"
//    • Return the cartId for Approval Agent to act on
//
//  Called by:
//    • runAgentPipeline() — step 4, receives needsReorder[]
//                          from PredictionAgent
//
//  Firestore reads:   users/{userId}     → platform, budgetPerOrder
//  Firestore writes:  users/{userId}/carts  → new cart document
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { emitEvent } from "./core.js";

// Coupon applied when subtotal meets minimum order value
const COUPON_MIN_ORDER    = 400;   // ₹
const COUPON_RATE         = 0.08;  // 8% discount
const CART_EXPIRY_HOURS   = 2;     // cart expires after 2 hours if not approved

// Urgency score map for sorting
const URGENCY_SCORE = { critical: 3, high: 2, normal: 1 };

export const ReorderAgent = {
  name: "Reorder",

  /**
   * Build an optimized cart from items that need reordering.
   *
   * @param {string}   userId
   * @param {object[]} itemsNeedingReorder - From PredictionAgent.run()
   * @returns {{ cartId: string, cart: object } | null}
   */
  async run(userId, itemsNeedingReorder) {
    emitEvent(this.name, "active", "Building optimized cart…");

    try {
      if (!itemsNeedingReorder.length) {
        emitEvent(this.name, "done", "No items need reordering");
        return null;
      }

      // ── Step 1: Load user preferences ─────────────────────
      const userSnap = await getDoc(doc(db, "users", userId));
      const prefs    = userSnap.data() || {};
      const platform = prefs.preferredPlatform || "Blinkit";
      const budget   = prefs.budgetPerOrder    || 800;   // ₹

      // ── Step 2: Sort by urgency — critical items go first ──
      const sorted = [...itemsNeedingReorder].sort(
        (a, b) =>
          (URGENCY_SCORE[b.prediction?.urgency] || 0) -
          (URGENCY_SCORE[a.prediction?.urgency] || 0)
      );

      // ── Step 3: Fill cart within budget ───────────────────
      const cartItems  = [];
      let runningTotal = 0;

      for (const item of sorted) {
        const price = item.lastPrice || item.estimatedPrice || 100;
        const qty   = item.reorderQty || 1;
        const cost  = price * qty;

        // Skip if adding this item would exceed budget
        // (but always add at least the first/most critical item)
        if (runningTotal + cost > budget && cartItems.length > 0) continue;

        cartItems.push({
          itemId:       item.id,
          name:         item.name,
          brand:        item.preferredBrand || "Best available",
          qty,
          unitPrice:    price,
          totalPrice:   cost,
          isSubstitute: false,
          urgency:      item.prediction?.urgency || "normal",
        });

        runningTotal += cost;
      }

      // ── Step 4: Calculate savings ──────────────────────────
      const subtotal     = cartItems.reduce((s, i) => s + i.totalPrice, 0);
      const couponSaving = subtotal >= COUPON_MIN_ORDER
        ? Math.round(subtotal * COUPON_RATE)
        : 0;
      const total = subtotal - couponSaving;

      // ── Step 5: Build cart document ───────────────────────
      const cart = {
        userId,
        platform,
        items:        cartItems,
        subtotal,
        couponSaving,
        total,
        status:       "pending_approval",
        createdAt:    serverTimestamp(),
        expiresAt:    new Date(
          Date.now() + CART_EXPIRY_HOURS * 3_600_000
        ).toISOString(),
      };

      // ── Step 6: Save to Firestore ──────────────────────────
      const cartRef = await addDoc(
        collection(db, "users", userId, "carts"),
        cart
      );

      emitEvent(
        this.name,
        "done",
        `Cart ready: ₹${total} on ${platform} (${cartItems.length} items)`,
        { cartId: cartRef.id, cart }
      );

      return { cartId: cartRef.id, cart };

    } catch (err) {
      emitEvent(this.name, "error", err.message);
      throw err;
    }
  },
};
