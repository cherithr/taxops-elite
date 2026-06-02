import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

// Your existing Firebase config
const firebaseConfig = {
  // paste your config here — same one you're already using
};

const app = initializeApp(firebaseConfig);

// Initialize Gemini via Firebase AI Logic
const ai = getAI(app, { backend: new GoogleAIBackend() });

export const model = getGenerativeModel(ai, { model: "gemini-2.0-flash" });
