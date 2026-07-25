// Public app configuration — safe to ship (Firestore/RTDB security is enforced
// by server-side rules, not by hiding these values).

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
}

export const APP_CONFIG: {
  firebase: FirebaseConfig;
  feedbackFormUrl: string;
} = {
  // TODO: paste the config of the new 3DCV Firebase project here. While apiKey
  // is empty, src/lib/client/main.ts skips initCloud entirely — sign-in and the
  // "online now" banner stay off and progress lives in localStorage only
  // (Export / Import JSON on the review page still works).
  //
  // After filling this in:
  //   1. Firestore rules:
  //        match /users/{uid} {
  //          allow read, write: if request.auth != null && request.auth.uid == uid;
  //        }
  //   2. Authentication -> Settings -> Authorized domains: add c0nsTantin77.github.io
  //   3. (optional) create a Realtime Database and set databaseURL for the live
  //      "people online" banner.
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    databaseURL: "",
  },
  // Google Form "embed" URL (Send -> <> -> copy the iframe src).
  feedbackFormUrl: "",
};
