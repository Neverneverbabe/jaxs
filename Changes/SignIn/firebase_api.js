// SignIn/firebase_api.js
import { auth, db, firebaseAuthFunctions, firebaseFirestoreFunctions } from './firebase.js';

// Firebase Authentication Functions
export async function createUserWithEmailAndPassword(authInstance, email, password) {
    const userCredential = await firebaseAuthFunctions.createUserWithEmailAndPassword(authInstance, email, password);
    return userCredential;
}

export async function signInWithEmailAndPassword(authInstance, email, password) {
    const userCredential = await firebaseAuthFunctions.signInWithEmailAndPassword(authInstance, email, password);
    return userCredential;
}

export async function signOut(authInstance) {
    await firebaseAuthFunctions.signOut(authInstance);
}

export function onAuthStateChanged(authInstance, callback) {
    return firebaseAuthFunctions.onAuthStateChanged(authInstance, callback);
}

export function getCurrentUser() {
    return auth.currentUser;
}

export async function updateProfile(user, profile) {
    await firebaseAuthFunctions.updateProfile(user, profile);
}

// Firebase Firestore Functions
export async function saveUserData(collectionName, docId, data) {
    const user = getCurrentUser();
    if (!user) throw new Error("User not signed in.");
    const docRef = firebaseFirestoreFunctions.doc(db, "users", user.uid, collectionName, docId);
    return await firebaseFirestoreFunctions.setDoc(docRef, data, { merge: true });
}

export async function getUserDataItem(collectionName, docId) {
    const user = getCurrentUser();
    if (!user) return null;
    const docRef = firebaseFirestoreFunctions.doc(db, "users", user.uid, collectionName, docId);
    const docSnap = await firebaseFirestoreFunctions.getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getUserCollection(collectionName) {
    const user = getCurrentUser();
    if (!user) return [];
    const collectionRef = firebaseFirestoreFunctions.collection(db, "users", user.uid, collectionName);
    const querySnapshot = await firebaseFirestoreFunctions.getDocs(collectionRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function listenToUserCollection(collectionName, callback) {
    const user = getCurrentUser();
    if (!user) return () => {};
    const collectionRef = firebaseFirestoreFunctions.collection(db, "users", user.uid, collectionName);
    return firebaseFirestoreFunctions.onSnapshot(collectionRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(items);
    });
}

export async function deleteUserData(collectionName, docId) {
    const user = getCurrentUser();
    if (!user) throw new Error("User not signed in.");
    const docRef = firebaseFirestoreFunctions.doc(db, "users", user.uid, collectionName, docId);
    return await firebaseFirestoreFunctions.deleteDoc(docRef);
}

export async function updateUserDataArray(collectionName, docId, field, value, operation) {
    const user = getCurrentUser();
    if (!user) throw new Error("User not signed in.");
    const docRef = firebaseFirestoreFunctions.doc(db, "users", user.uid, collectionName, docId);
    const updatePayload = {};
    if (operation === 'add') {
        updatePayload[field] = firebaseFirestoreFunctions.arrayUnion(value);
    } else if (operation === 'remove') {
        updatePayload[field] = firebaseFirestoreFunctions.arrayRemove(value);
    } else {
        throw new Error("Invalid array update operation.");
    }
    return await firebaseFirestoreFunctions.updateDoc(docRef, updatePayload);
}