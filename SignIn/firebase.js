// SignIn/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuthFunctions from 'firebase/auth'; // Import all auth functions
import * as FirebaseFirestoreFunctions from 'firebase/firestore'; // Import all firestore functions

const firebaseConfig = {
    apiKey: "AIzaSyAsLscv3km_0ywQFQb-1D3JhoN3pBS_ia8",
    authDomain: "watchlist-app-c5ecb.firebaseapp.com",
    projectId: "watchlist-app-c5ecb",
    storageBucket: "watchlist-app-c5ecb.appspot.com",
    messagingSenderId: "584689541926",
    appId: "1:584689541926:web:998b0499c6b84f0db597e7",
    measurementId: "G-Z0PJL94W66"
};

let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

export const db = FirebaseFirestoreFunctions.getFirestore(app);
export const auth = FirebaseAuthFunctions.getAuth(app);

// Re-export specific Firebase functions for convenience
export const firebaseAuthFunctions = FirebaseAuthFunctions;
export const firebaseFirestoreFunctions = FirebaseFirestoreFunctions;

// This function is no longer strictly needed as initialization happens on import,
// but kept as a no-op if other parts of the code expect it.
export async function loadFirebaseIfNeeded() {
    return true;
}