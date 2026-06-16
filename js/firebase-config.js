// Импорт функций из Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Ваша конфигурация (ВАШИ ключи!)
export const firebaseConfig = {
  apiKey: "AIzaSyA_LS74aEKlp1aQLEFJEfpu-cFtd3ucmsg",
  authDomain: "stretchwell-383bb.firebaseapp.com",
  projectId: "stretchwell-383bb",
  storageBucket: "stretchwell-383bb.firebasestorage.app",
  messagingSenderId: "597739897059",
  appId: "1:597739897059:web:83e1df531ad48194cc85d6",
  measurementId: "G-43KFX6GJZZ"
};

// Инициализация
const app = initializeApp(firebaseConfig);

// 🔥 ЭКСПОРТ
export const auth = getAuth(app);
export const db = getFirestore(app);