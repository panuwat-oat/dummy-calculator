import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

export { db };
