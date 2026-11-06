// Firebase setup, loaded straight from Google's servers (no build step, same as Finlora).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signInWithRedirect, GoogleAuthProvider, sendPasswordResetEmail, signOut, updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc,
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
// Offline cache: the app keeps working without signal and syncs when you're back online.
const db = app ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) : null;

/* ---------- auth ---------- */
export function watchUser(cb) { return onAuthStateChanged(auth, cb); }
export function logIn(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export function signUp(email, password) { return createUserWithEmailAndPassword(auth, email, password); }
export function resetPassword(email) { return sendPasswordResetEmail(auth, email); }
export function logOut() { return signOut(auth); }
export function saveDisplayName(name) { return auth.currentUser ? updateProfile(auth.currentUser, { displayName: name }) : Promise.resolve(); }
export async function logInWithGoogle() {
  const provider = new GoogleAuthProvider();
  // Popups are often blocked on phones, so fall back to a full-page redirect.
  try { return await signInWithPopup(auth, provider); }
  catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      return signInWithRedirect(auth, provider);
    }
    throw e;
  }
}

/* ---------- data: every user's data lives under users/{uid}/... ---------- */
// Returns a small store with the same shape the app used before: subscribe, put, patch, del.
export function userStore(uid) {
  const base = ['users', uid];
  const col = (name) => collection(db, ...base, name);
  const ref = (name, id) => doc(db, ...base, name, id);
  return {
    subscribe(name, next, error) {
      return onSnapshot(col(name), { includeMetadataChanges: true }, (snap) => {
        next(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])), snap.metadata.fromCache);
      }, error);
    },
    subscribeDoc(name, id, next, error) {
      return onSnapshot(ref(name, id), (snap) => next(snap.exists() ? snap.data() : null), error);
    },
    put: (name, id, data) => setDoc(ref(name, id), data),
    patch: (name, id, data) => updateDoc(ref(name, id), data),
    del: (name, id) => deleteDoc(ref(name, id)),
  };
}
