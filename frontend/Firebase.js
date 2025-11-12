// Firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDeM5vEFAmagyq_41yQ3RRkkFLSoCsh0cY",
  authDomain: "coliving-spaces.firebaseapp.com",
  projectId: "coliving-spaces",
  storageBucket: "coliving-spaces.appspot.com",
  messagingSenderId: "1003177598880",
  appId: "1:1003177598880:web:996c3afcc76e3731b7cec5",
  measurementId: "G-Y63TFJE1LJ",
};

// Prevent duplicate initialization
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // If auth is already initialized, get the existing instance
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

export { auth };

// Export app in case needed
export default app;