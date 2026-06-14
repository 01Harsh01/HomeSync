import { auth, provider, db } from "./firebase-config.js";
import {
  signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    await ensureUserDoc(result.user);
    return { success: true, user: result.user };
  } catch (err) {
    console.error("Sign-in error:", err);
    return { success: false, error: err.message };
  }
}

async function ensureUserDoc(user) {
  const ref  = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Brand new user — create minimal doc, onboarding will fill the rest
    await setDoc(ref, {
      uid:      user.uid,
      name:     user.displayName,
      email:    user.email,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
      onboardingComplete: false
    });
  }
}

export async function signOutUser() {
  await signOut(auth);
  const base = window.location.pathname.replace(/\/[^/]*$/, "/");
  window.location.href = base + "index.html";
}

// requiresAuth: true  = protected page
// requiresAuth: false = login page (redirect away if signed in)
export function initAuthGuard(requiresAuth = true) {
  onAuthStateChanged(auth, async (user) => {
    const path        = window.location.pathname;
    const base        = path.replace(/\/[^/]*$/, "/");
    const onLoginPage = /\/(index\.html)?$/.test(path);
    const onOnboarding = path.includes("onboarding");

    if (requiresAuth && !user) {
      window.location.href = base + "index.html";
      return;
    }

    if (!requiresAuth && user) {
      // Check if onboarding is complete
      const snap = await getDoc(doc(db, "users", user.uid));
      const onboarded = snap.data()?.onboardingComplete;
      window.location.href = base + (onboarded ? "dashboard.html" : "onboarding.html");
      return;
    }

    // On protected page — check if onboarding done
    if (requiresAuth && user && !onOnboarding) {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.data()?.onboardingComplete) {
        const base2 = path.replace(/\/[^/]*$/, "/");
        window.location.href = base2 + "onboarding.html";
        return;
      }
    }

    // Populate sidebar avatar/name
    if (user) {
      const avatarEl = document.getElementById("user-avatar");
      const nameEl   = document.getElementById("user-name");
      const emailEl  = document.getElementById("user-email");
      const fallback = document.getElementById("avatar-fallback");
      if (avatarEl && user.photoURL) {
        avatarEl.src = user.photoURL;
      } else if (fallback) {
        if (avatarEl) avatarEl.style.display = "none";
        fallback.style.display = "flex";
        fallback.textContent   = (user.displayName || "U")[0].toUpperCase();
      }
      if (nameEl)  nameEl.textContent  = user.displayName || "User";
      if (emailEl) emailEl.textContent = user.email || "";
    }
  });
}

export { auth };
