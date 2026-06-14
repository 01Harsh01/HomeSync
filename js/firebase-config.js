// ============================================================
//  STEP 1: Replace these placeholder values with your real
//          Firebase project config.
//
//  How to find them:
//  Firebase Console → Project Settings → Your apps → SDK setup
//  (choose "Config" not "npm")
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDI4bSeqXPOLK56xuyV0P_RPGpjpWc--fc",
  authDomain: "homeagent-ff5d1.firebaseapp.com",
  projectId: "homeagent-ff5d1",
  storageBucket: "homeagent-ff5d1.firebasestorage.app",
  messagingSenderId: "719607494127",
  appId: "1:719607494127:web:fa730922fd23bfcf16321a",
  measurementId: "G-DY1ZCXLKMY"
};


// ============================================================
//  STEP 2: Enable Google Sign-In
//  Firebase Console → Authentication → Sign-in method → Google → Enable
// ============================================================

// ============================================================
//  STEP 3: Authorize your domain
//  Firebase Console → Authentication → Settings → Authorized domains
//  Add your Netlify/Vercel URL (e.g. homeagent.netlify.app)
//  localhost is already allowed for local testing.
// ============================================================

import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);

export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db       = getFirestore(app);
