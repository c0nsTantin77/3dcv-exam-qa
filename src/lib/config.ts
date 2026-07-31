// Public app configuration — safe to ship (Firestore/RTDB security is enforced
// by server-side rules, not by hiding these values).

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  databaseURL?: string;
}

export const APP_CONFIG: {
  firebase: FirebaseConfig;
  feedbackFormUrl: string;
} = {
  // Dedicated 3DCV Firebase project. Do not reuse the busy I2DL project
  // (i2dl-c79f8). See docs/firebase-setup.md for the deployed Firestore and
  // Realtime Database rules and the console setup checklist.
  firebase: {
    apiKey: "AIzaSyBCqRTZJOaIMuCGnqj2uZNPgMtqL_CtvLo",
    authDomain: "dcv-exam-qa.firebaseapp.com",
    projectId: "dcv-exam-qa",
    storageBucket: "dcv-exam-qa.firebasestorage.app",
    messagingSenderId: "642608854619",
    appId: "1:642608854619:web:c26dc4efae86e3bbceb17e",
    measurementId: "G-M2F3GMJSLY",
    databaseURL: "https://dcv-exam-qa-default-rtdb.europe-west1.firebasedatabase.app",
  },
  // Google Form "embed" URL (Send -> <> -> copy the iframe src).
  feedbackFormUrl: "",
};
