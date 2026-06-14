# HomeAgent — Deployment Guide

## Quick start (5 minutes)

### 1. Create a Firebase project
1. Go to https://console.firebase.google.com
2. Click **Add project** → give it a name (e.g. `homeagent-prod`)
3. Disable Google Analytics if you don't need it → **Create project**

### 2. Enable Google Authentication
1. In your project → **Authentication** → **Get started**
2. Click **Sign-in method** tab → **Google** → toggle **Enable**
3. Set a support email → **Save**

### 3. Create a Firestore database
1. In your project → **Firestore Database** → **Create database**
2. Choose **Start in test mode** (you can add rules later)
3. Pick a region → **Done**

### 4. Get your Firebase config
1. In your project → **Project Settings** (gear icon) → **Your apps**
2. Click **</>** (Web) → register the app → copy the `firebaseConfig` object

### 5. Paste config into the app
Open `js/firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← paste your values
  authDomain:        "myapp.firebaseapp.com",
  projectId:         "myapp",
  storageBucket:     "myapp.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

---

## Deploy to Netlify (recommended — free)

1. Go to https://app.netlify.com → **Add new site** → **Deploy manually**
2. Drag and drop the `homeagent/` folder into the upload box
3. Your site will be live at `https://random-name.netlify.app`
4. **Add your domain to Firebase:**
   Firebase Console → Authentication → Settings → Authorized domains → **Add domain** → paste your Netlify URL

### Custom domain (optional)
Netlify → Site settings → Domain management → Add custom domain

---

## Deploy to Vercel (alternative — free)

```bash
npm i -g vercel
cd homeagent
vercel --prod
```

Add the Vercel URL to Firebase authorized domains (same step as above).

---

## Local development (no server needed)

Just open `index.html` directly in your browser — `localhost` is pre-authorized by Firebase.

> **Note:** If you see CORS errors, run a simple server:
> ```bash
> npx serve .          # or
> python3 -m http.server 3000
> ```

---

## File structure

```
homeagent/
├── index.html          ← Login page (public)
├── dashboard.html      ← Main dashboard (protected)
├── inventory.html      ← Inventory table (protected)
├── orders.html         ← Pending carts (protected)
├── history.html        ← Order history (protected)
├── analytics.html      ← Charts & insights (protected)
├── settings.html       ← Autonomy, budget, account (protected)
├── 404.html            ← Custom 404 page
├── netlify.toml        ← Netlify routing config
├── vercel.json         ← Vercel routing config
├── css/
│   ├── styles.css      ← Shared design system
│   └── login.css       ← Login page styles
└── js/
    ├── firebase-config.js  ← ⚠️  PUT YOUR KEYS HERE
    ├── auth.js             ← Google sign-in, auth guard
    └── shell.js            ← Sidebar + topbar injector
```

---

## Firestore security rules (production)

After testing, update your rules in Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
