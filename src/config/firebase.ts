import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCdj-5oF0d92kfoseQFENIdw7E4Ft7A_7w",
  authDomain: "ridgefield-golf-club.firebaseapp.com",
  projectId: "ridgefield-golf-club",
  storageBucket: "ridgefield-golf-club.firebasestorage.app",
  messagingSenderId: "210348651103",
  appId: "1:210348651103:web:b2102bd7200cc7be1121ea",
  measurementId: "G-JB5LWL67NH",
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth: Auth = getAuth(app);

// If you plan to use other Firebase services like Firestore,
// initialize them here and export as well:
import { getFirestore, Firestore } from "firebase/firestore";
const db: Firestore = getFirestore(app);

// Initialize Firebase Analytics and get a reference to the service
const analytics = getAnalytics(app);

export { auth, db, analytics };
