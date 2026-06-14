// ============================================================
//  js/agents/cartHelper.js
//
//  Shared helper for manually adding products to the user's
//  pending cart — used by the "Quick Add" / "Shop Products"
//  section on the dashboard (and reusable from inventory.html).
//
//  Behavior:
//    • If a "pending_approval" cart already exists, the product
//      is merged into it (qty++ if already present)
//    • If no pending cart exists, a new one is created using the
//      user's preferred platform from their profile
//    • Subtotal / coupon / total are recalculated automatically
//
//  Firestore reads:
//    • users/{userId}                → preferredPlatform
//    • users/{userId}/carts          → existing pending cart
//  Firestore writes:
//    • users/{userId}/carts/{id}     → new or updated cart
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
import { emitEvent } from "./core.js";

const COUPON_MIN_ORDER = 400;  // ₹ — minimum subtotal for coupon
const COUPON_RATE      = 0.08; // 8% discount

/**
 * Add a product to the user's pending cart (creating one if needed).
 *
 * @param {string} userId
 * @param {object} product
 * @param {string} product.itemId    - Unique identifier for the product
 * @param {string} product.name      - Display name
 * @param {string} product.brand     - Brand name
 * @param {string} product.category  - Category (for icon/grouping)
 * @param {number} product.unitPrice - Price per unit in ₹
 * @param {number} [product.qty=1]   - Quantity to add
 *
 * @returns {{ cartId: string, cart: object }}
 */
export async function addProductToCart(userId, product, qty = 1) {
  const cartsRef = collection(db, "users", userId, "carts");

  // ── Find existing pending cart ────────────────────────────
  const q    = query(cartsRef, where("status", "==", "pending_approval"), limit(1));
  const snap = await getDocs(q);

  if (!snap.empty) {
    // ── Merge into existing cart ────────────────────────────
    const cartDoc = snap.docs[0];
    const cart    = cartDoc.data();
    const items   = [...(cart.items || [])];

    const existing = items.find((i) => i.itemId === product.itemId);
    if (existing) {
      existing.qty = (existing.qty || 1) + qty;
    } else {
      items.push({
        itemId:       product.itemId,
        name:         product.name,
        brand:        product.brand,
        category:     product.category,
        qty,
        unitPrice:    product.unitPrice,
        isSubstitute: false,
        urgency:      "normal",
        source:       "manual",
      });
    }

    const { subtotal, couponSaving, total } = calculateTotals(items);

    await updateDoc(doc(db, "users", userId, "carts", cartDoc.id), {
      items, subtotal, couponSaving, total,
    });

    emitEvent("QuickAdd", "done", `${product.name} added to cart`, { cartId: cartDoc.id });
    return { cartId: cartDoc.id, cart: { ...cart, items, subtotal, couponSaving, total } };
  }

  // ── Create new cart ──────────────────────────────────────
  const userSnap = await getDoc(doc(db, "users", userId));
  const platform = userSnap.data()?.preferredPlatform || "Blinkit";

  const items = [{
    itemId:       product.itemId,
    name:         product.name,
    brand:        product.brand,
    category:     product.category,
    qty,
    unitPrice:    product.unitPrice,
    isSubstitute: false,
    urgency:      "normal",
    source:       "manual",
  }];

  const { subtotal, couponSaving, total } = calculateTotals(items);

  const cart = {
    userId,
    platform,
    items,
    subtotal,
    couponSaving,
    total,
    status:    "pending_approval",
    source:    "manual",
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  };

  const cartRef = await addDoc(cartsRef, cart);

  emitEvent("QuickAdd", "done", `${product.name} added — new cart created`, { cartId: cartRef.id });
  return { cartId: cartRef.id, cart };
}

/**
 * Remove a product from the pending cart by itemId.
 * If the cart becomes empty, it is left as an empty pending cart
 * (orders.html / dashboard will show the empty state).
 *
 * @param {string} userId
 * @param {string} itemId
 */
export async function removeProductFromCart(userId, itemId) {
  const cartsRef = collection(db, "users", userId, "carts");
  const q    = query(cartsRef, where("status", "==", "pending_approval"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const cartDoc = snap.docs[0];
  const cart    = cartDoc.data();
  const items   = (cart.items || []).filter((i) => i.itemId !== itemId);

  const { subtotal, couponSaving, total } = calculateTotals(items);

  await updateDoc(doc(db, "users", userId, "carts", cartDoc.id), {
    items, subtotal, couponSaving, total,
  });

  return { cartId: cartDoc.id, cart: { ...cart, items, subtotal, couponSaving, total } };
}

// ── Helper: recalculate subtotal/coupon/total ──────────────
function calculateTotals(items) {
  const subtotal     = items.reduce((s, i) => s + (i.unitPrice || 0) * (i.qty || 1), 0);
  const couponSaving = subtotal >= COUPON_MIN_ORDER ? Math.round(subtotal * COUPON_RATE) : 0;
  const total        = subtotal - couponSaving;
  return { subtotal, couponSaving, total };
}

/**
 * Curated product catalog for the "Quick Add" shopping section.
 * Each product maps to a category used by the icon system.
 */
export const PRODUCT_CATALOG = [
  { itemId:"milk-1l",       name:"Toned Milk 1L",        brand:"Amul",          category:"Dairy",      unitPrice:54  },
  { itemId:"bread-brown",   name:"Brown Bread",          brand:"Britannia",     category:"Bakery",     unitPrice:55  },
  { itemId:"eggs-6",        name:"Eggs (6-pack)",        brand:"Farm Fresh",    category:"Dairy",      unitPrice:48  },
  { itemId:"rice-5kg",      name:"Basmati Rice 5kg",     brand:"India Gate",    category:"Pantry",     unitPrice:450 },
  { itemId:"oil-1l",        name:"Sunflower Oil 1L",     brand:"Fortune",       category:"Pantry",     unitPrice:145 },
  { itemId:"tomato-1kg",    name:"Tomatoes 1kg",         brand:"Fresh Produce", category:"Vegetables", unitPrice:35  },
  { itemId:"onion-1kg",     name:"Onions 1kg",           brand:"Fresh Produce", category:"Vegetables", unitPrice:30  },
  { itemId:"turmeric-100g", name:"Turmeric Powder 100g", brand:"Everest",       category:"Spices",     unitPrice:42  },
  { itemId:"detergent-1kg", name:"Detergent 1kg",        brand:"Surf Excel",    category:"Cleaning",   unitPrice:180 },
  { itemId:"tea-250g",      name:"Tea Powder 250g",      brand:"Tata Tea",      category:"Beverages",  unitPrice:140 },
  { itemId:"chicken-500g",  name:"Chicken Breast 500g",  brand:"Licious",       category:"Meat",       unitPrice:220 },
  { itemId:"paneer-200g",   name:"Paneer 200g",          brand:"Amul",          category:"Dairy",      unitPrice:90  },
];
