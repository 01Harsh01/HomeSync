// ============================================================
//  HomeAgent — Complete Multi-Agent Backend
//  Works entirely client-side with Firestore
//  No server required for Phase 1 & 2
// ============================================================
import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc,
  updateDoc, addDoc, serverTimestamp,
  query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const LOW_STOCK    = 20;
const CRITICAL     = 10;
const REORDER_LEAD = 3; // days before predicted stockout

// ── Event broadcaster — UI listens to these ───────────────
export function emitEvent(agent, status, message, data = {}) {
  window.dispatchEvent(new CustomEvent("agent-event", {
    detail: { agent, status, message, data, ts: new Date().toISOString() }
  }));
}

// ============================================================
//  CONSUMPTION MULTIPLIER
//  Called during onboarding to compute a household scaling factor
//  e.g. a family of 4 adults + 2 kids uses ~5.1x a single adult
// ============================================================
export function computeConsumptionMultiplier({ adults, elderly, children, guests, cookFreq }) {
  const childRates = { "0-2": 0.20, "3-5": 0.35, "6-12": 0.55, "13-17": 0.85 };
  let total = adults;
  total += (elderly || 0) * 0.70;
  for (const [key, rate] of Object.entries(childRates)) {
    total += (children?.[key] || 0) * rate;
  }
  // Guest buffer
  const guestBuffer = [0, 0.05, 0.12, 0.20][guests] || 0;
  total *= (1 + guestBuffer);
  // Cook frequency modifier
  const cookMod = { always: 1.0, often: 0.85, sometimes: 0.65, rarely: 0.40 };
  total *= (cookMod[cookFreq] || 1.0);
  return Math.round(total * 100) / 100;
}

// ============================================================
//  INVENTORY AGENT
//  Reads inventory, updates status flags, returns items
// ============================================================
export const InventoryAgent = {
  name: "Inventory",
  async run(userId) {
    emitEvent(this.name, "active", "Scanning inventory…");
    try {
      const snap  = await getDocs(collection(db, "users", userId, "inventory"));
      const items = [];
      for (const d of snap.docs) {
        const item   = { id: d.id, ...d.data() };
        const status = item.stockPct <= CRITICAL ? "critical"
                     : item.stockPct <= LOW_STOCK ? "low" : "ok";
        if (item.status !== status) {
          await updateDoc(doc(db, "users", userId, "inventory", d.id), { status });
          item.status = status;
        }
        items.push(item);
      }
      const low = items.filter(i => i.status !== "ok");
      emitEvent(this.name, "done", `${items.length} items · ${low.length} need attention`, { items, low });
      return { items, low };
    } catch (e) { emitEvent(this.name, "error", e.message); throw e; }
  }
};

// ============================================================
//  CONSUMPTION AGENT
//  Uses onboarding multiplier + purchase history to set weekly usage
// ============================================================
export const ConsumptionAgent = {
  name: "Consumption",
  async run(userId, items) {
    emitEvent(this.name, "active", "Analyzing consumption patterns…");
    try {
      const userSnap   = await getDoc(doc(db, "users", userId));
      const multiplier = userSnap.data()?.family?.consumptionMultiplier || 1;
      const updated    = [];

      for (const item of items) {
        const q    = query(
          collection(db, "users", userId, "purchaseHistory"),
          where("itemId", "==", item.id),
          orderBy("purchasedAt", "desc"),
          limit(10)
        );
        const hist = (await getDocs(q)).docs.map(d => d.data());

        // Weighted moving average of purchase intervals
        let weeklyUsage = (item.baseWeeklyUsage || item.weeklyUsage || 1) * multiplier;
        if (hist.length >= 2) {
          const oldest  = hist[hist.length - 1].purchasedAt?.toDate();
          const newest  = hist[0].purchasedAt?.toDate();
          const days    = oldest && newest ? Math.abs((newest - oldest) / 86400000) : 0;
          if (days > 0) {
            const total = hist.reduce((s, h) => s + (h.qty || 1), 0);
            weeklyUsage = (total / days) * 7 * multiplier;
          }
        }
        weeklyUsage = Math.round(weeklyUsage * 10) / 10;

        // Days left = (stockPct% of totalQty) / daily rate
        const dailyRate = weeklyUsage / 7;
        const daysLeft  = dailyRate > 0
          ? Math.round((item.stockPct / 100) * (item.totalQuantity || 10) / dailyRate)
          : 999;

        await updateDoc(doc(db, "users", userId, "inventory", item.id), { weeklyUsage, daysLeft });
        updated.push({ ...item, weeklyUsage, daysLeft });
      }
      emitEvent(this.name, "done", `Consumption rates updated (×${multiplier} household)`, { updated });
      return updated;
    } catch (e) { emitEvent(this.name, "error", e.message); throw e; }
  }
};

// ============================================================
//  PREDICTION AGENT
//  Predicts stockout dates, flags items needing reorder
// ============================================================
export const PredictionAgent = {
  name: "Prediction",
  async run(userId, items) {
    emitEvent(this.name, "active", "Running stockout predictions…");
    try {
      const needsReorder = [];
      for (const item of items) {
        const daysLeft    = item.daysLeft ?? 999;
        const stockoutDate = new Date();
        stockoutDate.setDate(stockoutDate.getDate() + daysLeft);
        const urgency = daysLeft <= 1 ? "critical" : daysLeft <= 3 ? "high" : "normal";
        const pred    = { daysLeft, stockoutDate: stockoutDate.toISOString(),
                          needsReorder: daysLeft <= REORDER_LEAD, urgency };

        await updateDoc(doc(db, "users", userId, "inventory", item.id), { prediction: pred });

        if (pred.needsReorder) {
          needsReorder.push({ ...item, prediction: pred });
          this._notify(item.name, daysLeft);
        }
      }
      emitEvent(this.name, "done", `${needsReorder.length} items flagged for reorder`, { needsReorder });
      return needsReorder;
    } catch (e) { emitEvent(this.name, "error", e.message); throw e; }
  },
  _notify(name, days) {
    if (Notification?.permission === "granted") {
      new Notification("HomeAgent: Low stock", {
        body: `${name} runs out in ~${days} day${days !== 1 ? "s" : ""}`,
        icon: "/favicon.ico"
      });
    }
  }
};

// ============================================================
//  REORDER AGENT
//  Builds optimized cart from items needing reorder
//  Respects user preferences, budget caps, substitutes
// ============================================================
export const ReorderAgent = {
  name: "Reorder",
  async run(userId, itemsNeedingReorder) {
    emitEvent(this.name, "active", "Building optimized cart…");
    try {
      if (!itemsNeedingReorder.length) {
        emitEvent(this.name, "done", "No items need reordering"); return null;
      }
      const userSnap = await getDoc(doc(db, "users", userId));
      const prefs    = userSnap.data() || {};
      const platform = prefs.preferredPlatform || "Blinkit";
      const budget   = prefs.budgetPerOrder    || 800;

      // Sort by urgency — critical first
      const sorted = [...itemsNeedingReorder].sort((a, b) => {
        const urgencyScore = { critical: 3, high: 2, normal: 1 };
        return (urgencyScore[b.prediction?.urgency] || 0) - (urgencyScore[a.prediction?.urgency] || 0);
      });

      const cartItems = [];
      let runningTotal = 0;
      for (const item of sorted) {
        const price = item.lastPrice || item.estimatedPrice || 100;
        const qty   = item.reorderQty || 1;
        if (runningTotal + price * qty > budget && cartItems.length > 0) continue;
        cartItems.push({
          itemId:      item.id,
          name:        item.name,
          brand:       item.preferredBrand || "Best available",
          qty,
          unitPrice:   price,
          isSubstitute: false,
          urgency:     item.prediction?.urgency || "normal"
        });
        runningTotal += price * qty;
      }

      const subtotal    = cartItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
      const couponSaving = subtotal >= 400 ? Math.round(subtotal * 0.08) : 0;
      const total        = subtotal - couponSaving;

      const cart = {
        userId, platform, items: cartItems, subtotal,
        couponSaving, total, status: "pending_approval",
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 2 * 3600000).toISOString()
      };
      const ref = await addDoc(collection(db, "users", userId, "carts"), cart);

      emitEvent(this.name, "done",
        `Cart ready: ₹${total} on ${platform}`,
        { cartId: ref.id, cart }
      );
      return { cartId: ref.id, cart };
    } catch (e) { emitEvent(this.name, "error", e.message); throw e; }
  }
};

// ============================================================
//  APPROVAL AGENT
//  Phase 1/2 → requires human approval
//  Phase 3 → auto-approves within budget
// ============================================================
export const ApprovalAgent = {
  name: "Approval",
  async run(userId, cartId) {
    emitEvent(this.name, "active", "Checking approval requirements…");
    try {
      const userSnap      = await getDoc(doc(db, "users", userId));
      const autonomyLevel = userSnap.data()?.autonomyLevel || 1;
      if (autonomyLevel >= 3) {
        await this.approve(userId, cartId);
        emitEvent(this.name, "done", "Auto-approved (Phase 3)");
        return { approved: true, auto: true };
      }
      emitEvent(this.name, "waiting", "Waiting for user approval…", { cartId });
      return { approved: false, requiresHuman: true, cartId };
    } catch (e) { emitEvent(this.name, "error", e.message); throw e; }
  },
  async approve(userId, cartId) {
    await updateDoc(doc(db, "users", userId, "carts", cartId), {
      status: "approved", approvedAt: serverTimestamp()
    });
    emitEvent(this.name, "done", "Cart approved ✓");
  },
  async decline(userId, cartId, reason = "") {
    await updateDoc(doc(db, "users", userId, "carts", cartId), {
      status: "declined", declinedAt: serverTimestamp(), declineReason: reason
    });
    emitEvent(this.name, "done", "Cart declined");
  }
};

// ============================================================
//  SHOPPING AGENT
//  Executes approved cart, logs order, schedules inventory update
// ============================================================
export const ShoppingAgent = {
  name: "Shopping",
  async run(userId, cartId) {
    emitEvent(this.name, "active", "Placing order…");
    try {
      const cartSnap = await getDoc(doc(db, "users", userId, "carts", cartId));
      if (!cartSnap.exists()) throw new Error("Cart not found");
      const cart = cartSnap.data();
      if (cart.status !== "approved") throw new Error("Cart not approved");

      // Simulate order placement (replace with Blinkit/Zepto API in production)
      const orderId    = "ORD-" + Date.now();
      const deliveryAt = new Date(Date.now() + 20 * 60000);

      await addDoc(collection(db, "users", userId, "orders"), {
        orderId, cartId, platform: cart.platform, items: cart.items,
        total: cart.total, couponSaving: cart.couponSaving,
        status: "placed", placedAt: serverTimestamp(),
        estimatedDelivery: deliveryAt.toISOString()
      });
      await updateDoc(doc(db, "users", userId, "carts", cartId), {
        status: "ordered", orderId
      });

      // Auto-update inventory after simulated delivery
      setTimeout(() => this._onDelivered(userId, cartId, cart), 20 * 60000);

      emitEvent(this.name, "done",
        `Order ${orderId} placed on ${cart.platform} — est. 20 min`,
        { orderId }
      );
      return { orderId, deliveryAt };
    } catch (e) { emitEvent(this.name, "error", e.message); throw e; }
  },
  async _onDelivered(userId, cartId, cart) {
    emitEvent(this.name, "active", "Delivery confirmed — updating inventory…");
    for (const item of cart.items) {
      const ref  = doc(db, "users", userId, "inventory", item.itemId);
      const snap = await getDoc(ref);
      if (!snap.exists()) continue;
      const cur    = snap.data();
      const addPct = item.qty * (cur.pctPerUnit || 20);
      const newPct = Math.min(100, (cur.stockPct || 0) + addPct);
      await updateDoc(ref, {
        stockPct: newPct,
        status: newPct <= CRITICAL ? "critical" : newPct <= LOW_STOCK ? "low" : "ok",
        lastDelivered: serverTimestamp()
      });
      await addDoc(collection(db, "users", userId, "purchaseHistory"), {
        itemId: item.itemId, name: item.name, qty: item.qty,
        price: item.unitPrice, purchasedAt: serverTimestamp()
      });
    }
    const ordQ = query(
      collection(db, "users", userId, "orders"),
      where("cartId", "==", cartId), limit(1)
    );
    const ordSnap = await getDocs(ordQ);
    if (!ordSnap.empty) {
      await updateDoc(ordSnap.docs[0].ref, { status: "delivered", deliveredAt: serverTimestamp() });
    }
    emitEvent(this.name, "done", "Inventory updated after delivery ✓");
  }
};

// ============================================================
//  SELF-LEARNING AGENT
//  Runs weekly — retrains consumption weights with recency bias
// ============================================================
export const SelfLearningAgent = {
  name: "Learning",
  async run(userId) {
    emitEvent(this.name, "active", "Retraining consumption models…");
    try {
      const snap     = await getDocs(collection(db, "users", userId, "inventory"));
      let improved   = 0;
      const weights  = [0.35, 0.25, 0.20, 0.12, 0.08];

      for (const d of snap.docs) {
        const item = d.data();
        const q    = query(
          collection(db, "users", userId, "purchaseHistory"),
          where("itemId", "==", d.id),
          orderBy("purchasedAt", "desc"),
          limit(5)
        );
        const hist = (await getDocs(q)).docs.map(h => h.data());
        if (hist.length < 2) continue;

        let wu = 0, ws = 0;
        hist.forEach((h, i) => { const w = weights[i] || 0.05; wu += (h.qty||1)*w; ws += w; });
        const newWeeklyUsage = ws > 0 ? Math.round((wu/ws)*7*10)/10 : item.weeklyUsage;

        if (Math.abs(newWeeklyUsage - (item.weeklyUsage || 0)) > 0.1) {
          await updateDoc(doc(db, "users", userId, "inventory", d.id), {
            weeklyUsage: newWeeklyUsage, modelUpdatedAt: serverTimestamp()
          });
          improved++;
        }
      }
      emitEvent(this.name, "done", `Retrained ${improved} models`);
      return { improved };
    } catch (e) { emitEvent(this.name, "error", e.message); throw e; }
  }
};

// ============================================================
//  PIPELINE ORCHESTRATOR
//  Runs all agents in sequence — call on page load + interval
// ============================================================
export async function runAgentPipeline(userId) {
  emitEvent("Pipeline", "active", "Starting agent pipeline…");
  try {
    const { items }            = await InventoryAgent.run(userId);
    const withConsumption      = await ConsumptionAgent.run(userId, items);
    const needsReorder         = await PredictionAgent.run(userId, withConsumption);

    if (needsReorder.length > 0) {
      const cartResult = await ReorderAgent.run(userId, needsReorder);
      if (cartResult) {
        const approval = await ApprovalAgent.run(userId, cartResult.cartId);
        if (approval.approved) {
          await ShoppingAgent.run(userId, cartResult.cartId);
        }
      }
    }
    emitEvent("Pipeline", "done", "Pipeline complete ✓");
    return { success: true };
  } catch (e) {
    emitEvent("Pipeline", "error", e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
//  SEED INVENTORY
//  Creates demo items for new users, scaled by household profile
//  diet = "vegetarian"|"nonveg"|"vegan"|"eggetarian"|"mixed"
// ============================================================
export async function seedInventoryIfEmpty(userId, { diet, multiplier, dietNeeds } = {}) {
  const ref  = collection(db, "users", userId, "inventory");
  const snap = await getDocs(ref);
  if (!snap.empty) return;

  multiplier = multiplier || 1;

  // Base item templates
  const allItems = [
    // Dairy
    { name: "Full-cream milk",   category:"Dairy",      stockPct:14, baseWeeklyUsage:3.5, daysLeft:2,  reorderQty:2, pctPerUnit:25, estimatedPrice:58,  preferredBrand:"Amul",          tags:["veg","eggetarian","mixed","nonveg"] },
    { name: "Eggs (12-pack)",    category:"Dairy",      stockPct:58, baseWeeklyUsage:1,   daysLeft:6,  reorderQty:1, pctPerUnit:100,estimatedPrice:96,  preferredBrand:"Nandus",        tags:["eggetarian","mixed","nonveg"] },
    { name: "Yogurt (400g)",     category:"Dairy",      stockPct:60, baseWeeklyUsage:2,   daysLeft:5,  reorderQty:2, pctPerUnit:100,estimatedPrice:45,  preferredBrand:"Amul",          tags:["veg","eggetarian","mixed","nonveg"] },
    { name: "Paneer (200g)",     category:"Dairy",      stockPct:40, baseWeeklyUsage:1,   daysLeft:8,  reorderQty:1, pctPerUnit:100,estimatedPrice:75,  preferredBrand:"Amul",          tags:["veg"] },
    // Pantry
    { name: "Rice (5 kg)",       category:"Pantry",     stockPct:76, baseWeeklyUsage:0.4, daysLeft:18, reorderQty:1, pctPerUnit:80, estimatedPrice:280, preferredBrand:"India Gate",    tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    { name: "Toor dal",          category:"Pantry",     stockPct:65, baseWeeklyUsage:0.25,daysLeft:14, reorderQty:1, pctPerUnit:90, estimatedPrice:120, preferredBrand:"Tata Sampann",  tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    { name: "Cooking oil 1L",    category:"Pantry",     stockPct:8,  baseWeeklyUsage:0.5, daysLeft:1,  reorderQty:1, pctPerUnit:60, estimatedPrice:145, preferredBrand:"Fortune",       tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    { name: "Salt (1kg)",        category:"Pantry",     stockPct:90, baseWeeklyUsage:0.05,daysLeft:45, reorderQty:1, pctPerUnit:100,estimatedPrice:28,  preferredBrand:"Tata",          tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    { name: "Turmeric powder",   category:"Spices",     stockPct:80, baseWeeklyUsage:0.05,daysLeft:25, reorderQty:1, pctPerUnit:100,estimatedPrice:55,  preferredBrand:"Everest",       tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    { name: "Whole wheat bread", category:"Bakery",     stockPct:10, baseWeeklyUsage:2,   daysLeft:1,  reorderQty:1, pctPerUnit:70, estimatedPrice:48,  preferredBrand:"Britannia",     tags:["veg","eggetarian","mixed","nonveg"] },
    // Vegetables (fresh — shorter cycle)
    { name: "Tomatoes (kg)",     category:"Vegetables", stockPct:45, baseWeeklyUsage:1.5, daysLeft:4,  reorderQty:2, pctPerUnit:100,estimatedPrice:40,  preferredBrand:"Fresh",         tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    { name: "Onions (kg)",       category:"Vegetables", stockPct:52, baseWeeklyUsage:1,   daysLeft:8,  reorderQty:2, pctPerUnit:100,estimatedPrice:35,  preferredBrand:"Fresh",         tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    { name: "Potatoes (kg)",     category:"Vegetables", stockPct:60, baseWeeklyUsage:0.8, daysLeft:10, reorderQty:2, pctPerUnit:100,estimatedPrice:30,  preferredBrand:"Fresh",         tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    // Chicken/fish for non-veg
    { name: "Chicken breast",    category:"Meat",       stockPct:30, baseWeeklyUsage:0.5, daysLeft:3,  reorderQty:1, pctPerUnit:100,estimatedPrice:220, preferredBrand:"Nandus",        tags:["nonveg","mixed"] },
    // Cleaning
    { name: "Dish soap",         category:"Cleaning",   stockPct:42, baseWeeklyUsage:0.1, daysLeft:9,  reorderQty:1, pctPerUnit:80, estimatedPrice:65,  preferredBrand:"Vim",           tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    { name: "Detergent powder",  category:"Cleaning",   stockPct:30, baseWeeklyUsage:0.2, daysLeft:12, reorderQty:1, pctPerUnit:70, estimatedPrice:210, preferredBrand:"Ariel",         tags:["veg","eggetarian","mixed","nonveg","vegan"] },
    // Beverages
    { name: "Green tea bags",    category:"Beverages",  stockPct:35, baseWeeklyUsage:5,   daysLeft:7,  reorderQty:1, pctPerUnit:100,estimatedPrice:150, preferredBrand:"Tetley",        tags:["veg","eggetarian","mixed","nonveg","vegan"] },
  ];

  // Filter by diet
  const dietKey = diet || "veg";
  const filtered = allItems.filter(item =>
    item.tags.some(t =>
      t === dietKey ||
      (dietKey === "vegetarian" && t === "veg") ||
      (dietKey === "vegan"      && t === "vegan")
    )
  );

  for (const item of filtered) {
    const weeklyUsage = Math.round(item.baseWeeklyUsage * multiplier * 10) / 10;
    await addDoc(ref, {
      ...item,
      weeklyUsage,
      totalQuantity: 10,
      status:    item.stockPct <= CRITICAL ? "critical" : item.stockPct <= LOW_STOCK ? "low" : "ok",
      prediction: {
        daysLeft:     item.daysLeft,
        needsReorder: item.daysLeft <= REORDER_LEAD,
        urgency:      item.daysLeft <= 1 ? "critical" : item.daysLeft <= 3 ? "high" : "normal"
      },
      createdAt: serverTimestamp()
    });
  }
}
