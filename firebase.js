// js/firebase.js
import {
    initializeApp,
    getApps,
    getApp,
} from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    getDoc,
    query,
    where,
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAsLscv3km_0ywQFQb-1D3JhoN3pBS_ia8",
    authDomain: "watchlist-app-c5ecb.firebaseapp.com",
    projectId: "watchlist-app-c5ecb",
    storageBucket: "watchlist-app-c5ecb.appspot.com",
    messagingSenderId: "584689541926",
    appId: "1:584689541926:web:998b0499c6b84f0db597e7",
    measurementId: "G-Z0PJL94W66"
};

let db = {};
let auth = {};
let firebaseAuthFunctions = {};
let firebaseFirestoreFunctions = {};

if (typeof process === 'undefined') {
    let app;
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }

    db = getFirestore(app);
    auth = getAuth(app);

    firebaseAuthFunctions = {
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        signOut,
        onAuthStateChanged
    };

    firebaseFirestoreFunctions = {
        collection,
        getDocs,
        doc,
        setDoc,
        deleteDoc,
        updateDoc,
        arrayUnion,
        arrayRemove,
        getDoc,
        query,
        where
    };
} else {
    firebaseAuthFunctions = {
        createUserWithEmailAndPassword: async () => {},
        signInWithEmailAndPassword: async () => {},
        signOut: async () => {},
        onAuthStateChanged: () => {}
    };
    firebaseFirestoreFunctions = {
        collection: () => {},
        getDocs: async () => ({ docs: [] }),
        doc: () => {},
        setDoc: async () => {},
        deleteDoc: async () => {},
        updateDoc: async () => {},
        arrayUnion: (...args) => args,
        arrayRemove: (...args) => args,
        getDoc: async () => ({ exists: () => false }),
        query: () => {},
        where: () => {}
    };
}

export { db, auth, firebaseAuthFunctions, firebaseFirestoreFunctions };

export async function loadFirebaseIfNeeded() {
    // Initialization happens automatically on module load
    return true;
}
