// ============ FIREBASE SETUP ============
// 1. Paste your project's config below (Firebase Console → Project Settings
//    → General → "Your apps" → SDK setup and configuration → Config).
// 2. Set BOOTSTRAP_ADMIN_EMAIL to the email you'll register with first —
//    that one account is auto-approved as admin so you're never locked out.
//    Every email after that registers as "pending" until an existing admin
//    approves it (see admin/dashboard.html → Admin Users).
// 3. In Firebase Console, enable Authentication → Sign-in method → Email/Password.
//    That toggle can't be set from code — it's the one manual step.
//
// Nothing else needs to be created by hand: the `admins` and `products`
// collections, and every field inside them, are written automatically the
// first time you register or save a product/guide form.

  const firebaseConfig = {
    apiKey: "AIzaSyDYYIFaXJ8vzYcmuWMVEccXwb-J3AQTh-Q",
    authDomain: "digitalcreator-28cd5.firebaseapp.com",
    projectId: "digitalcreator-28cd5",
    storageBucket: "digitalcreator-28cd5.firebasestorage.app",
    messagingSenderId: "896699925652",
    appId: "1:896699925652:web:c0329682c27c86bbc96081",
    measurementId: "G-7332YG8ET6"
  };

const BOOTSTRAP_ADMIN_EMAIL = "rizwan@digitalcreator.tech"; // ← change this to your own email

// Free image hosting for product box images, used by admin/product-form.html.
// Get a key at https://api.imgbb.com/ (free, no card required) and paste it
// here. Leave as-is and the form falls back to typing an image path/URL
// manually — upload just won't be available until this is set.
const IMGBB_API_KEY = "74c1453b68399dcb3a8cb9b312e0bc58";

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// Public pages (index/bundle/guide) only load the Firestore SDK — auth-guard.js
// and the admin/login/register pages load the Auth SDK too, so only
// initialize it when it's actually present.
const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;


