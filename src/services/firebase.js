// Firebase Configuration - Simplified
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyCBOBb7mJPoI7cwubp12xnmjglLkuWYWYI",
    authDomain: "it-inventory-eaebc.firebaseapp.com",
    projectId: "it-inventory-eaebc",
    storageBucket: "it-inventory-eaebc.firebasestorage.app",
    messagingSenderId: "1081021280207",
    appId: "1:1081021280207:web:9619a96bff1692493aecba"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

console.log('Firebase initialized successfully');