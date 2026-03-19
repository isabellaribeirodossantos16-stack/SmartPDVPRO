
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBOTSIspy2kZjAvKmnFIvSz6wpxxiLmxKA",
  authDomain: "smartpdv-pro.firebaseapp.com",
  projectId: "smartpdv-pro",
  storageBucket: "smartpdv-pro.firebasestorage.app",
  messagingSenderId: "956880799494",
  appId: "1:956880799494:web:bb3757819c6b54c435c087",
  measurementId: "G-8FQC4PD7Z6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
const analytics = getAnalytics(app);
