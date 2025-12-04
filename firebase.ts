
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAv_RcliVSjLNeBgCSeShlfcduXNz9A0Mc",
  authDomain: "neon-circuit-de4bb.firebaseapp.com",
  projectId: "neon-circuit-de4bb",
  storageBucket: "neon-circuit-de4bb.firebasestorage.app",
  messagingSenderId: "915262743178",
  appId: "1:915262743178:web:5dafeb19458455dbda0373"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
