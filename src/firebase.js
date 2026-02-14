import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD8Gi30sPAgCOHK026FUsSLUZCe3k1eSLA",
  authDomain: "dummy-calculator.firebaseapp.com",
  projectId: "dummy-calculator",
  storageBucket: "dummy-calculator.firebasestorage.app",
  messagingSenderId: "439738377979",
  appId: "1:439738377979:web:cc41031fd34aaaad6a325e",
  measurementId: "G-QPC60BED6M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a a time.
    console.warn('Firestore persistence failed-precondition');
  } else if (err.code == 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore persistence unimplemented');
  }
});

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };
