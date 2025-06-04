// js/firebase.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth as fbGetAuth, // Renamed to avoid conflict if you have a local getAuth
    createUserWithEmailAndPassword as fbCreateUserWithEmailAndPassword,
    signInWithEmailAndPassword as fbSignInWithEmailAndPassword,
    signOut as fbSignOut,
    onAuthStateChanged as fbOnAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore as fbGetFirestore, // Renamed
    collection as fbCollection,
    getDocs as fbGetDocs,
    doc as fbDoc,
    setDoc as fbSetDoc,
    deleteDoc as fbDeleteDoc,
    updateDoc as fbUpdateDoc,
    arrayUnion as fbArrayUnion,
    arrayRemove as fbArrayRemove,
    getDoc as fbGetDoc,
    query as fbQuery,
    where as fbWhere
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsLscv3km_0ywQFQb-1D3JhoN3pBS_ia8", // IMPORTANT: Keep your actual API key secure
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

export const db = fbGetFirestore(app);
export const auth = fbGetAuth(app);

export const firebaseAuthFunctions = {
    createUserWithEmailAndPassword: fbCreateUserWithEmailAndPassword,
    signInWithEmailAndPassword: fbSignInWithEmailAndPassword,
    signOut: fbSignOut,
    onAuthStateChanged: fbOnAuthStateChanged
};

export const firebaseFirestoreFunctions = {
    collection: fbCollection,
    getDocs: fbGetDocs,
    doc: fbDoc,
    setDoc: fbSetDoc,
    deleteDoc: fbDeleteDoc,
    updateDoc: fbUpdateDoc,
    arrayUnion: fbArrayUnion,
    arrayRemove: fbArrayRemove,
    getDoc: fbGetDoc,
    query: fbQuery,
    where: fbWhere
};

// This function ensures Firebase is loaded, especially if initial SDK load in HTML fails.
// However, with direct imports like above, this dynamic import might be less critical
// but can be kept as a fallback or for specific scenarios.
export async function loadFirebaseIfNeeded() {
    // This function's body would essentially re-ensure the `db` and `auth` instances are ready
    // For simplicity with direct imports, we'll assume they are initialized above.
    // If you face issues with Firebase not loading, you might need to reinstate
    // the dynamic import logic here, but it could conflict with the top-level imports.
    if (db && auth) return true; // Already initialized
    console.warn("Firebase was not initialized as expected. Attempting re-init (might be redundant).");
    // Re-initialize or throw an error
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    // This part is tricky because db and auth are const exports.
    // For now, we rely on the initial setup.
    // If truly needed, db and auth would need to be `let` and reassigned,
    // or this function would return new instances that the app must use.
    return false;
}