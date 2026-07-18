import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGOR3kDdKOXmOX9Zif09-ZPzoBRDAcSnI",
  authDomain: "inductor-stick.firebaseapp.com",
  projectId: "inductor-stick",
  storageBucket: "inductor-stick.firebasestorage.app",
  messagingSenderId: "337540028796",
  appId: "1:337540028796:web:4a704968a405e69d11ecf9",
  measurementId: "G-L1ZRDKGVHL",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;