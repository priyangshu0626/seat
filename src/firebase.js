import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCdIApjk2IYeh7nUOCx6XZdPlTpT-4WbQM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "iimsbp.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "iimsbp",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "iimsbp.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "690140775203",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:690140775203:web:3dba6bea3c039242590296",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
