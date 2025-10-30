// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
//import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBCg12RSuuIYJEUZazFSF5r2C8knaUfmkw",
  authDomain: "sis-alert-1e7a7.firebaseapp.com",
  projectId: "sis-alert-1e7a7",
  storageBucket: "sis-alert-1e7a7.firebasestorage.app",
  messagingSenderId: "496828677813",
  appId: "1:496828677813:web:8bbc8da77017f80cdb48fc",
  measurementId: "G-JEH246XMQV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
export const auth = getAuth(app); 