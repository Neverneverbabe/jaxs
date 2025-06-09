// js/firebase.js
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
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

    let app;
    if (!appMod.getApps().length) {
        app = appMod.initializeApp(firebaseConfig);
    } else {
        app = appMod.getApp();
    }

    db = fsMod.getFirestore(app);
    auth = authMod.getAuth(app);

    firebaseAuthFunctions = {
        createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
        signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
        signOut: authMod.signOut,
        onAuthStateChanged: authMod.onAuthStateChanged
    };

    firebaseFirestoreFunctions = {
        collection: fsMod.collection,
        getDocs: fsMod.getDocs,
        doc: fsMod.doc,
        setDoc: fsMod.setDoc,
        deleteDoc: fsMod.deleteDoc,
        updateDoc: fsMod.updateDoc,
        arrayUnion: fsMod.arrayUnion,
        arrayRemove: fsMod.arrayRemove,
        getDoc: fsMod.getDoc,
        query: fsMod.query,
        where: fsMod.where
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
