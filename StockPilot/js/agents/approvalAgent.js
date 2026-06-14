// ============================================================
//  js/agents/approvalAgent.js
//
//  AGENT 5 — APPROVAL AGENT
//  ─────────────────────────
//  Responsibility:
//    • Check the user's autonomy level setting
//    • Phase 1 / 2: emit "waiting" — human must click Approve
//    • Phase 3:     auto-approve immediately, pass to ShoppingAgent
//    • Expose approve() and decline() for UI buttons to call
//
//  Called by:
//    • runAgentPipeline()          — step 5
//    • Approve button click        — approvalAgent.approve()
//    • Decline button click        — approvalAgent.decline()
//
//  Autonomy levels (set in Settings page):
//    1 = Alerts only  — always requires human approval
//    2 = Cart builder — always requires human approval
//    3 = Full auto    — approves and orders without asking
//
//  Firestore reads:   users/{userId}             → autonomyLevel
//  Firestore writes:  users/{userId}/carts/{id}  → status, approvedAt
// ============================================================

import { db } from "../firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { emitEvent } from "./core.js";

export const ApprovalAgent = {
  name: "Approval",

  /**
   * Entry point from the pipeline.
   * Checks autonomy level and either auto-approves or waits.
   *
   * @param {string} userId
   * @param {string} cartId
   * @returns {{ approved: boolean, auto?: boolean, requiresHuman?: boolean }}
   */
  async run(userId, cartId) {
    emitEvent(this.name, "active", "Checking approval requirements…");

    try {
      const userSnap      = await getDoc(doc(db, "users", userId));
      const autonomyLevel = userSnap.data()?.autonomyLevel || 1;

      if (autonomyLevel >= 3) {
        // Phase 3: auto-approve — no human needed
        await this.approve(userId, cartId);
        emitEvent(
          this.name,
          "done",
          "Cart auto-approved (Phase 3 autonomy) ✓"
        );
        return { approved: true, auto: true };
      }

      // Phase 1 or 2: human approval required
      // UI listens for this event and shows the cart card
      emitEvent(
        this.name,
        "waiting",
        "Cart ready — waiting for your approval",
        { cartId, autonomyLevel }
      );
      return { approved: false, requiresHuman: true, cartId };

    } catch (err) {
      emitEvent(this.name, "error", err.message);
      throw err;
    }
  },

  // ── Called by Approve button in orders.html ───────────────
  /**
   * Marks a cart as approved in Firestore.
   * After calling this, pass cartId to ShoppingAgent.run().
   *
   * @param {string} userId
   * @param {string} cartId
   *
   * Usage in orders.html:
   *   approveBtn.onclick = async () => {
   *     await ApprovalAgent.approve(userId, cartId);
   *     await ShoppingAgent.run(userId, cartId);
   *   };
   */
  async approve(userId, cartId) {
    await updateDoc(doc(db, "users", userId, "carts", cartId), {
      status:     "approved",
      approvedAt: serverTimestamp(),
    });
    emitEvent(this.name, "done", "Cart approved ✓", { cartId });
  },

  // ── Called by Decline button in orders.html ───────────────
  /**
   * Marks a cart as declined.
   * Agent will rebuild a new cart in the next pipeline run.
   *
   * @param {string} userId
   * @param {string} cartId
   * @param {string} reason  - Optional reason string
   */
  async decline(userId, cartId, reason = "") {
    await updateDoc(doc(db, "users", userId, "carts", cartId), {
      status:        "declined",
      declinedAt:    serverTimestamp(),
      declineReason: reason,
    });
    emitEvent(this.name, "done", "Cart declined", { cartId, reason });
  },
};
