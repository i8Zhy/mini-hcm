import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC6_EXM1ryNdDL54KTz1Jb-y4xG3dI7miU",
  authDomain: "mini-hcm-28683.firebaseapp.com",
  projectId: "mini-hcm-28683",
  storageBucket: "mini-hcm-28683.firebasestorage.app",
  messagingSenderId: "214647514777",
  appId: "1:214647514777:web:06db8ebd7cc6c63f003a08"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;