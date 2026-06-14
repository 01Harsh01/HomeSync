// ============================================================
//  js/agents/multiplier.js
//  Computes a household consumption scaling factor from
//  the family profile collected during onboarding.
//
//  Used by:
//    - onboarding.html  (saved to Firestore on first setup)
//    - ConsumptionAgent (applied to every item's weekly usage)
// ============================================================

/**
 * Age-group consumption rates relative to one adult.
 * Based on ICMR nutritional guidelines.
 */
const CHILD_RATES = {
  "0-2":  0.20,   // Infants    — 20% of adult consumption
  "3-5":  0.35,   // Toddlers   — 35%
  "6-12": 0.55,   // Children   — 55%
  "13-17":0.85,   // Teenagers  — 85%
};

/**
 * Guest frequency buffer added on top of base consumption.
 * Index corresponds to the guest dropdown value (0–3).
 */
const GUEST_BUFFER = [0, 0.05, 0.12, 0.20];

/**
 * Cook frequency modifier — how much of pantry items are consumed
 * vs ordered in from restaurants.
 */
const COOK_MOD = {
  always:    1.00,
  often:     0.85,
  sometimes: 0.65,
  rarely:    0.40,
};

/**
 * Compute a single multiplier number representing the household's
 * total consumption relative to one adult cooking every day.
 *
 * @param {object} profile
 * @param {number} profile.adults       - Number of adults (18+)
 * @param {number} profile.elderly      - Number of elderly (60+)
 * @param {object} profile.children     - { "0-2": n, "3-5": n, "6-12": n, "13-17": n }
 * @param {number} profile.guests       - Frequency level 0–3
 * @param {string} profile.cookFreq     - "always" | "often" | "sometimes" | "rarely"
 *
 * @returns {number} multiplier  e.g. 3.25
 *
 * Example:
 *   computeConsumptionMultiplier({
 *     adults: 2, elderly: 0,
 *     children: { "3-5": 1, "6-12": 1 },
 *     guests: 1, cookFreq: "always"
 *   })
 *   → 2 + 0.35 + 0.55 = 2.90 × 1.05 (guests) × 1.0 (always cook) = 3.05
 */
export function computeConsumptionMultiplier({
  adults   = 1,
  elderly  = 0,
  children = {},
  guests   = 0,
  cookFreq = "always",
}) {
  let total = adults;

  // Add elderly at 70% adult rate
  total += elderly * 0.70;

  // Add each child age group
  for (const [key, rate] of Object.entries(CHILD_RATES)) {
    total += (children[key] || 0) * rate;
  }

  // Apply guest frequency buffer
  total *= (1 + (GUEST_BUFFER[guests] || 0));

  // Apply cook frequency modifier
  total *= (COOK_MOD[cookFreq] || 1.0);

  // Round to 2 decimal places
  return Math.round(total * 100) / 100;
}
