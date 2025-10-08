// Firebase Configuration - Simplified
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';

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

// Connect to emulators in development
if (import.meta.env.DEV) {
    try {
        connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
        connectFirestoreEmulator(db, 'localhost', 8080);
        console.log('Connected to Firebase emulators');
    } catch (error) {
        console.log('Emulators not running, using production Firebase');
    }
}

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

console.log('Firebase initialized successfully');