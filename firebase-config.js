// Firebase Configuration
// Replace these values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCBOBb7mJPoI7cwubp12xnmjglLkuWYWYI",
  authDomain: "it-inventory-eaebc.firebaseapp.com",
  projectId: "it-inventory-eaebc",
  storageBucket: "it-inventory-eaebc.firebasestorage.app",
  messagingSenderId: "1081021280207",
  appId: "1:1081021280207:web:9619a96bff1692493aecba",
  measurementId: "G-NCD75FKBK4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence().catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code == 'unimplemented') {
    console.warn('The current browser does not support offline persistence');
  }
});

console.log('🔥 Firebase initialized with offline persistence');
