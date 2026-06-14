# 🏠 HomeSync — Autonomous Household Inventory & Ordering Agent

> **Submitted for Japan Hackathon 2026**
> An AI-powered multi-agent system that tracks household consumables, predicts depletion, and automates replenishment — so your family never runs out of essentials.

---

## 📌 Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [Live Demo](#live-demo)
- [Multi-Agent Architecture](#multi-agent-architecture)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Deployment](#setup--deployment)
- [How It Works](#how-it-works)
- [Agent Pipeline](#agent-pipeline)
- [Screenshots](#screenshots)
- [Future Roadmap](#future-roadmap)
- [Team](#team)

---

## Problem Statement

Every household faces the same invisible problem: **running out of essentials at the worst possible time.**

Families manually track dozens of consumables across pantry, dairy, vegetables, and cleaning supplies. This leads to:
- Frequent stockouts of daily essentials
- Repeated emergency orders at premium prices
- Cognitive load of tracking 40–50 items across multiple family members
- No learning — the same items run out month after month

---

## Solution Overview

**HomeAgent** is an autonomous AI agent system that:

1. **Learns** your household's unique consumption patterns using family size, age groups, diet, and cooking frequency
2. **Predicts** when each item will run out — before it actually does
3. **Builds** optimized shopping carts with best prices, coupons, and substitutes
4. **Orders** automatically (with your approval) from Blinkit, Zepto, Swiggy Instamart, or BigBasket
5. **Improves** over time using a self-learning consumption model

---

## Live Demo

🔗 **[homeagent.netlify.app](https://nimble-cat-674cf7.netlify.app)**

**Test credentials:** Sign in with any Google account — onboarding takes 2 minutes.

---

## Multi-Agent Architecture

```
Mobile / Web App
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                    Agent Pipeline                        │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  Inventory  │───▶│ Consumption │───▶│  Prediction │  │
│  │   Agent     │    │   Agent     │    │   Agent     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                                               │          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────▼───────┐  │
│  │  Shopping   │◀───│  Approval   │◀───│   Reorder   │  │
│  │   Agent     │    │   Agent     │    │   Agent     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Self-Learning Consumption Agent           │   │
│  │  (runs weekly — retrains models with real data)   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
       │
       ▼
  Firebase Firestore (real-time data store)
```

---

## Key Features

### 🧠 Intelligent Onboarding
- Family composition: adults, elderly, children by age group (infants/toddlers/children/teens)
- Diet type: vegetarian, non-veg, vegan, eggetarian
- Cooking frequency & special dietary needs
- **Consumption multiplier** automatically calculated — a family of 4 adults + 2 children uses ~5.1× more than a single adult

### 📦 Smart Inventory Tracking
- 47 item categories pre-seeded based on household profile and diet
- Real-time stock levels with visual progress bars
- Critical / Low / OK status with color coding
- Days-left prediction for every item

### 🔮 Consumption Prediction
- Machine learning model trained on actual purchase history
- Accounts for guest frequency, seasonal variation, cooking habits
- Recency-weighted retraining via Self-Learning Agent
- Stockout date prediction with urgency scoring

### 🛒 Automated Cart Building
- Pre-built optimized carts with best prices across platforms
- Automatic coupon application (8% on orders ₹400+)
- Smart substitution when preferred brand is out of stock
- Budget-aware — respects per-order and monthly caps

### ✅ Gradual Autonomy Model
| Phase | Behavior |
|-------|----------|
| Phase 1 — Alerts | Agent notifies you. You order manually. |
| Phase 2 — Cart Builder | Agent builds cart. You approve with one tap. |
| Phase 3 — Full Auto | Agent orders within budget caps. Notifies after. |

### 📊 Analytics Dashboard
- Weekly spend trends
- Savings breakdown (bulk pricing, coupons, substitutes, price comparison)
- Consumption by category
- Forecast accuracy over time

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5, CSS3, ES6 Modules |
| **Authentication** | Firebase Auth (Google Sign-In) |
| **Database** | Firebase Firestore (real-time NoSQL) |
| **Agent Engine** | Custom JavaScript multi-agent system |
| **Charts** | Chart.js 4.4 |
| **Deployment** | Netlify (CDN, global edge) |
| **Backend (planned)** | FastAPI + Python for marketplace API integration |
| **ML (planned)** | Prophet / custom time-series models |

**No build tools. No npm. No bundler.** Pure ES modules loaded directly in the browser — deploy anywhere with zero configuration.

---

## Project Structure

```
homeagent/
│
├── index.html              # Login page — Google Sign-In
├── onboarding.html         # 5-step household setup (new users)
├── dashboard.html          # Main dashboard — live agent pipeline
├── inventory.html          # Full inventory table with search & filters
├── orders.html             # Pending carts — approve / edit / decline
├── history.html            # Order history with savings breakdown
├── analytics.html          # Charts — spend, categories, accuracy
├── settings.html           # Autonomy, budget, integrations, account
├── 404.html                # Custom not-found page
│
├── css/
│   ├── styles.css          # Global design system (dark theme)
│   ├── login.css           # Login page styles
│   └── onboarding.css      # Onboarding flow styles
│
├── js/
│   ├── firebase-config.js  # ⚠️  Firebase keys go here
│   ├── auth.js             # Google auth, auth guard, routing
│   ├── shell.js            # Shared sidebar + topbar injector
│   └── agents.js           # All 7 agents + pipeline orchestrator
│
├── netlify.toml            # Netlify routing config
├── vercel.json             # Vercel routing config
├── README.md               # This file
└── SETUP.md                # Detailed deployment guide
```

---

## Setup & Deployment

### Prerequisites
- A Google account
- A Firebase project (free Spark plan is enough)

### Step 1 — Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project → disable Analytics → **Create project**
3. **Authentication** → Get started → Sign-in method → **Google** → Enable → Save
4. **Firestore Database** → Create database → Start in test mode → Region: `asia-northeast1 (Tokyo)` → Done
5. **Project Settings** → Your apps → `</>` Web → Register app → Copy the config

### Step 2 — Add Firebase Config

Open `js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

### Step 3 — Firestore Security Rules

Firebase Console → Firestore → **Rules** tab → Paste and publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

### Step 4 — Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Deploy manually**
2. Drag and drop the **`homeagent_final.zip`** into the deploy box
3. Wait 10 seconds → live URL assigned

### Step 5 — Authorize Your Domain

Firebase Console → Authentication → **Settings** → Authorized domains → **Add domain** → paste your `*.netlify.app` URL

### Step 6 — Test

| Action | Expected |
|--------|----------|
| Open site | Styled login page |
| Sign in with Google | → Onboarding (5 steps) |
| Complete onboarding | → Dashboard, agents start running |
| Sign in again | → Dashboard directly (onboarding skipped) |

---

## How It Works

### User Journey

```
1. Sign in with Google
        │
        ▼
2. Onboarding (new users only)
   • Household name & city
   • Family: adults + children by age group + elderly + guests
   • Diet type & cooking frequency
   • Preferred platform & budget caps
   • Autonomy level (Phase 1/2/3)
        │
        ▼
3. Dashboard loads
   • Inventory seeded from household profile
   • Agent pipeline runs automatically
   • Live pipeline status shown in UI
        │
        ▼
4. Agents run every 6 hours
   • Inventory Agent scans all items
   • Consumption Agent adjusts rates by family multiplier
   • Prediction Agent forecasts stockout dates
   • Reorder Agent builds cart if items are running low
   • Approval Agent checks autonomy level
   • Shopping Agent places order (Phase 3) or waits for approval
        │
        ▼
5. Self-Learning Agent runs weekly
   • Retrains consumption models from actual purchase history
   • Uses recency-weighted moving average
   • Accounts for guest visits, seasonal changes
```

### Consumption Multiplier Formula

The agent calculates a household multiplier during onboarding:

```
multiplier = adults × 1.0
           + elderly × 0.70
           + infants (0-2) × 0.20
           + toddlers (3-5) × 0.35
           + children (6-12) × 0.55
           + teenagers (13-17) × 0.85
           × guest buffer (0–20%)
           × cook frequency modifier (0.4–1.0)
```

**Example:** 2 adults + 1 toddler + 1 child, often guests, cook daily:
`= (2×1.0) + (1×0.35) + (1×0.55) × 1.12 × 1.0 = **3.25×**`

---

## Agent Pipeline

```javascript
// js/agents.js — simplified

runAgentPipeline(userId)
  → InventoryAgent.run()       // scan Firestore, flag low/critical
  → ConsumptionAgent.run()     // update weekly usage × multiplier
  → PredictionAgent.run()      // compute daysLeft, stockout dates
  → ReorderAgent.run()         // build optimized cart in Firestore
  → ApprovalAgent.run()        // auto or manual approval
  → ShoppingAgent.run()        // place order, update on delivery
```

---

## Future Roadmap

### Phase 2 (Next 3 months)
- [ ] Gmail receipt OCR via Cloud Functions
- [ ] UPI/SMS bank transaction parsing
- [ ] Real Blinkit & Zepto API integration via FastAPI backend
- [ ] WhatsApp notifications via Twilio

### Phase 3 (6 months)
- [ ] Prophet-based time-series forecasting
- [ ] Seasonal pattern detection (festivals, monsoon, etc.)
- [ ] Price tracking across platforms
- [ ] Group household sharing (multi-user)
- [ ] Mobile app (React Native)

### Phase 4 (12 months)
- [ ] Computer vision pantry scanning via phone camera
- [ ] Voice commands ("Hey HomeAgent, add milk")
- [ ] Integration with smart home devices
- [ ] B2B version for small restaurants and offices

---

## Why This Wins

| Criterion | HomeAgent |
|-----------|-----------|
| **Real problem** | Every Indian household faces stockouts daily |
| **AI-native** | 7 specialized agents, not a CRUD app with AI sprinkled on |
| **Learns** | Self-improving consumption model — gets smarter every week |
| **Privacy-first** | All data in user's own Firestore — no third-party servers |
| **Deployable** | Zero build tools — live on Netlify in 10 minutes |
| **Scalable architecture** | Agent pattern scales from 1 household to 1 million |

---

## Team

**Harsh** — Electronics & Instrumentation Engineering
NIT Agartala, Batch 2024–2028

- Full-stack development
- Multi-agent system design
- Firebase architecture
- UI/UX design

---

## License

MIT License — free to use, modify, and distribute.

---

*Built with ❤️ for Japan Hackathon 2026*
