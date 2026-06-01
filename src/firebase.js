// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA1ttMSCQ_zh8bb4S5Yly8ROJFOV48NuIQ",
  authDomain: "taxops-elite.firebaseapp.com",
  projectId: "taxops-elite",
  storageBucket: "taxops-elite.firebasestorage.app",
  messagingSenderId: "1029832152458",
  appId: "1:1029832152458:web:6083824672cfdabd552473",
  measurementId: "G-X459N6N3XH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);