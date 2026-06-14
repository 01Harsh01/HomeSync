// ============================================================
//  js/agents/pipeline.js
//  Master orchestrator — imports all individual agents and
//  runs them in the correct sequence.
//  This is the ONLY file other pages need to import.
//
//  Usage on any protected page:
//    import { runAgentPipeline, seedInventoryIfEmpty } from "./js/agents/pipeline.js";
//    import { ApprovalAgent } from "./js/agents/pipeline.js";
//    import { ShoppingAgent } from "./js/agents/pipeline.js";
// ============================================================

import { db }                 from "../firebase-config.js";
import { InventoryAgent }     from "./inventoryAgent.js";
import { ConsumptionAgent }   from "./consumptionAgent.js";
import { PredictionAgent }    from "./predictionAgent.js";
import { ReorderAgent }       from "./reorderAgent.js";
import { ApprovalAgent }      from "./approvalAgent.js";
import { ShoppingAgent }      from "./shoppingAgent.js";
import { SelfLearningAgent }  from "./selfLearningAgent.js";
import { emitEvent }          from "./core.js";
import {
  collection, addDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Re-export all agents so pages only need one import
export {
  InventoryAgent,
  ConsumptionAgent,
  PredictionAgent,
  ReorderAgent,
  ApprovalAgent,
  ShoppingAgent,
  SelfLearningAgent,
};

export { computeConsumptionMultiplier } from "./multiplier.js";

// ── Main pipeline ─────────────────────────────────────────
export async function runAgentPipeline(userId) {
  emitEvent("Pipeline", "active", "Starting agent pipeline…");
  try {
    const { items }       = await InventoryAgent.run(userId);
    const withConsumption = await ConsumptionAgent.run(userId, items);
    const needsReorder    = await PredictionAgent.run(userId, withConsumption);

    if (needsReorder.length > 0) {
      const cartResult = await ReorderAgent.run(userId, needsReorder);
      if (cartResult) {
        const approval = await ApprovalAgent.run(userId, cartResult.cartId);
        if (approval.approved) {
          await ShoppingAgent.run(userId, cartResult.cartId);
        }
      }
    }

    // Schedule weekly self-learning
    SelfLearningAgent.scheduleWeeklyRun(userId);

    emitEvent("Pipeline", "done", "Pipeline complete ✓");
    return { success: true };
  } catch (err) {
    emitEvent("Pipeline", "error", err.message);
    return { success: false, error: err.message };
  }
}

// ── Seed demo inventory for new users ─────────────────────
export async function seedInventoryIfEmpty(userId, { diet, multiplier, dietNeeds } = {}) {
  const ref  = collection(db, "users", userId, "inventory");
  const snap = await getDocs(ref);
  if (!snap.empty) return;

  multiplier = multiplier || 1;

  const allItems = [
    { name:"Full-cream milk",   category:"Dairy",      stockPct:14, baseWeeklyUsage:3.5, daysLeft:2,  reorderQty:2, pctPerUnit:25,  totalQuantity:10, estimatedPrice:58,  preferredBrand:"Amul",         tags:["vegetarian","eggetarian","mixed","nonveg"] },
    { name:"Eggs (12-pack)",    category:"Dairy",      stockPct:58, baseWeeklyUsage:1,   daysLeft:6,  reorderQty:1, pctPerUnit:100, totalQuantity:1,  estimatedPrice:96,  preferredBrand:"Nandus",       tags:["eggetarian","mixed","nonveg"] },
    { name:"Yogurt (400g)",     category:"Dairy",      stockPct:60, baseWeeklyUsage:2,   daysLeft:5,  reorderQty:2, pctPerUnit:100, totalQuantity:4,  estimatedPrice:45,  preferredBrand:"Amul",         tags:["vegetarian","eggetarian","mixed","nonveg"] },
    { name:"Paneer (200g)",     category:"Dairy",      stockPct:40, baseWeeklyUsage:1,   daysLeft:8,  reorderQty:1, pctPerUnit:100, totalQuantity:2,  estimatedPrice:75,  preferredBrand:"Amul",         tags:["vegetarian"] },
    { name:"Rice (5 kg)",       category:"Pantry",     stockPct:76, baseWeeklyUsage:0.4, daysLeft:18, reorderQty:1, pctPerUnit:80,  totalQuantity:5,  estimatedPrice:280, preferredBrand:"India Gate",   tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Toor dal",          category:"Pantry",     stockPct:65, baseWeeklyUsage:0.25,daysLeft:14, reorderQty:1, pctPerUnit:90,  totalQuantity:2,  estimatedPrice:120, preferredBrand:"Tata Sampann", tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Cooking oil 1L",    category:"Pantry",     stockPct:8,  baseWeeklyUsage:0.5, daysLeft:1,  reorderQty:1, pctPerUnit:60,  totalQuantity:1,  estimatedPrice:145, preferredBrand:"Fortune",      tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Salt (1kg)",        category:"Pantry",     stockPct:90, baseWeeklyUsage:0.05,daysLeft:45, reorderQty:1, pctPerUnit:100, totalQuantity:1,  estimatedPrice:28,  preferredBrand:"Tata",         tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Turmeric powder",   category:"Spices",     stockPct:80, baseWeeklyUsage:0.05,daysLeft:25, reorderQty:1, pctPerUnit:100, totalQuantity:1,  estimatedPrice:55,  preferredBrand:"Everest",      tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Red chilli powder", category:"Spices",     stockPct:70, baseWeeklyUsage:0.04,daysLeft:20, reorderQty:1, pctPerUnit:100, totalQuantity:1,  estimatedPrice:48,  preferredBrand:"Everest",      tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Whole wheat bread", category:"Bakery",     stockPct:10, baseWeeklyUsage:2,   daysLeft:1,  reorderQty:1, pctPerUnit:70,  totalQuantity:2,  estimatedPrice:48,  preferredBrand:"Britannia",    tags:["vegetarian","eggetarian","mixed","nonveg"] },
    { name:"Tomatoes (kg)",     category:"Vegetables", stockPct:45, baseWeeklyUsage:1.5, daysLeft:4,  reorderQty:2, pctPerUnit:100, totalQuantity:2,  estimatedPrice:40,  preferredBrand:"Fresh",        tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Onions (kg)",       category:"Vegetables", stockPct:52, baseWeeklyUsage:1,   daysLeft:8,  reorderQty:2, pctPerUnit:100, totalQuantity:2,  estimatedPrice:35,  preferredBrand:"Fresh",        tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Potatoes (kg)",     category:"Vegetables", stockPct:60, baseWeeklyUsage:0.8, daysLeft:10, reorderQty:2, pctPerUnit:100, totalQuantity:2,  estimatedPrice:30,  preferredBrand:"Fresh",        tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Chicken breast",    category:"Meat",       stockPct:30, baseWeeklyUsage:0.5, daysLeft:3,  reorderQty:1, pctPerUnit:100, totalQuantity:1,  estimatedPrice:220, preferredBrand:"Nandus",       tags:["nonveg","mixed"] },
    { name:"Dish soap",         category:"Cleaning",   stockPct:42, baseWeeklyUsage:0.1, daysLeft:9,  reorderQty:1, pctPerUnit:80,  totalQuantity:1,  estimatedPrice:65,  preferredBrand:"Vim",          tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Detergent powder",  category:"Cleaning",   stockPct:30, baseWeeklyUsage:0.2, daysLeft:12, reorderQty:1, pctPerUnit:70,  totalQuantity:2,  estimatedPrice:210, preferredBrand:"Ariel",        tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Hand wash 200ml",   category:"Cleaning",   stockPct:55, baseWeeklyUsage:0.1, daysLeft:11, reorderQty:1, pctPerUnit:80,  totalQuantity:1,  estimatedPrice:85,  preferredBrand:"Dettol",       tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Green tea bags",    category:"Beverages",  stockPct:35, baseWeeklyUsage:5,   daysLeft:7,  reorderQty:1, pctPerUnit:100, totalQuantity:25, estimatedPrice:150, preferredBrand:"Tetley",       tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
    { name:"Instant coffee",    category:"Beverages",  stockPct:50, baseWeeklyUsage:2,   daysLeft:9,  reorderQty:1, pctPerUnit:100, totalQuantity:1,  estimatedPrice:180, preferredBrand:"Nescafe",      tags:["vegetarian","eggetarian","mixed","nonveg","vegan"] },
  ];

  const filtered = allItems.filter(item =>
    item.tags.includes(diet || "vegetarian")
  );

  for (const item of filtered) {
    const weeklyUsage = Math.round(item.baseWeeklyUsage * multiplier * 10) / 10;
    await addDoc(ref, {
      ...item,
      weeklyUsage,
      status: item.stockPct <= 10 ? "critical" : item.stockPct <= 20 ? "low" : "ok",
      prediction: {
        daysLeft:     item.daysLeft,
        needsReorder: item.daysLeft <= 3,
        urgency:      item.daysLeft <= 1 ? "critical" : item.daysLeft <= 3 ? "high" : "normal"
      },
      createdAt: serverTimestamp()
    });
  }
  console.log(`✅ Seeded ${filtered.length} items for new user`);
}
