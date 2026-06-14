// ============================================================
//  js/agents/shoppingAgent.js
//
//  AGENT 6 — SHOPPING AGENT
//  ─────────────────────────
//  Responsibility:
//    • Verify cart exists and is in "approved" state
//    • Generate a unique order ID
//    • Save order to users/{userId}/orders collection
//    • Update cart status to "ordered"
//    • Schedule _onDelivered() after estimated delivery time
//    • On delivery: update inventory stock levels + log purchase history
//
//  Called by:
//    • runAgentPipeline()  — step 6 (Phase 3 auto only)
//    • Approve button      — after ApprovalAgent.approve() resolves
//
//  NOTE: Order placement is currently simulated.
//  To integrate a real platform (Blinkit / Zepto / Swiggy):
//    1. Set up a FastAPI backend
//    2. Replace the simulation block with a fetch() call
//    3. See the comment marked "PRODUCTION: replace here"
//
//  Firestore reads:
//    • users/{userId}/carts/{cartId}
//  Firestore writes:
//    • users/{userId}/orders              → new order document
//    • users/{userId}/carts/{cartId}      → status "ordered"
//    • users/{userId}/inventory/{itemId}  → stockPct, status (on delivery)
//    • users/{userId}/purchaseHistory     → one doc per item (on delivery)
// ============================================================

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { emitEvent, LOW_STOCK, CRITICAL } from "./core.js";

// Simulated delivery time in minutes
const DELIVERY_MINUTES = 20;

export const ShoppingAgent = {
  name: "Shopping",

  /**
   * Places the order for an approved cart.
   *
   * @param {string} userId
   * @param {string} cartId
   * @returns {{ orderId: string, deliveryAt: Date }}
   */
  async run(userId, cartId) {
    emitEvent(this.name, "active", "Placing order…");

    try {
      // ── Step 1: Load and validate cart ────────────────────
      const cartSnap = await getDoc(
        doc(db, "users", userId, "carts", cartId)
      );

      if (!cartSnap.exists()) {
        throw new Error(`Cart ${cartId} not found`);
      }

      const cart = cartSnap.data();

      if (cart.status !== "approved") {
        throw new Error(
          `Cart is not approved — current status: ${cart.status}`
        );
      }

      // ── Step 2: Place the order ────────────────────────────
      const orderId    = "ORD-" + Date.now();
      const deliveryAt = new Date(Date.now() + DELIVERY_MINUTES * 60_000);

      // PRODUCTION: replace this block with a real API call ↓
      // ─────────────────────────────────────────────────────
      // const response = await fetch("https://your-api.com/order", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     platform: cart.platform,
      //     items:    cart.items,
      //     userId,
      //   }),
      // });
      // const { orderId, estimatedDelivery } = await response.json();
      // ─────────────────────────────────────────────────────

      // ── Step 3: Save order to Firestore ───────────────────
      await addDoc(collection(db, "users", userId, "orders"), {
        orderId,
        cartId,
        platform:          cart.platform,
        items:             cart.items,
        total:             cart.total,
        couponSaving:      cart.couponSaving,
        status:            "placed",
        placedAt:          serverTimestamp(),
        estimatedDelivery: deliveryAt.toISOString(),
      });

      // ── Step 4: Update cart status ─────────────────────────
      await updateDoc(doc(db, "users", userId, "carts", cartId), {
        status:  "ordered",
        orderId,
      });

      // ── Step 5: Schedule delivery callback ────────────────
      // In production, this would be a webhook from the platform.
      // Here we simulate it with a setTimeout.
      setTimeout(
        () => this._onDelivered(userId, cartId, cart),
        DELIVERY_MINUTES * 60_000
      );

      emitEvent(
        this.name,
        "done",
        `Order ${orderId} placed on ${cart.platform} — est. ${DELIVERY_MINUTES} min`,
        { orderId, deliveryAt }
      );

      return { orderId, deliveryAt };

    } catch (err) {
      emitEvent(this.name, "error", err.message);
      throw err;
    }
  },

  // ── Delivery callback ─────────────────────────────────────
  /**
   * Called after delivery time elapses.
   * Updates inventory stock levels and logs purchase history
   * so ConsumptionAgent has accurate data for next run.
   *
   * @param {string} userId
   * @param {string} cartId
   * @param {object} cart     - Cart data snapshot
   */
  async _onDelivered(userId, cartId, cart) {
    emitEvent(this.name, "active", "Delivery confirmed — updating inventory…");

    try {
      // Update each item's stock level
      for (const item of cart.items) {
        const ref  = doc(db, "users", userId, "inventory", item.itemId);
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;

        const current = snap.data();

        // Add stock based on qty purchased × pct per unit
        const addPct  = item.qty * (current.pctPerUnit || 20);
        const newPct  = Math.min(100, (current.stockPct || 0) + addPct);
        const status  =
          newPct <= CRITICAL  ? "critical" :
          newPct <= LOW_STOCK ? "low"      : "ok";

        await updateDoc(ref, {
          stockPct:      newPct,
          status,
          lastDelivered: serverTimestamp(),
        });

        // Log to purchase history for learning agent
        await addDoc(
          collection(db, "users", userId, "purchaseHistory"),
          {
            itemId:      item.itemId,
            name:        item.name,
            qty:         item.qty,
            price:       item.unitPrice,
            purchasedAt: serverTimestamp(),
          }
        );
      }

      // Mark order as delivered
      const ordQ  = query(
        collection(db, "users", userId, "orders"),
        where("cartId", "==", cartId),
        limit(1)
      );
      const ordSnap = await getDocs(ordQ);
      if (!ordSnap.empty) {
        await updateDoc(ordSnap.docs[0].ref, {
          status:      "delivered",
          deliveredAt: serverTimestamp(),
        });
      }

      emitEvent(
        this.name,
        "done",
        "Delivery confirmed — inventory updated ✓"
      );

    } catch (err) {
      emitEvent(this.name, "error", `Delivery update failed: ${err.message}`);
    }
  },
};
