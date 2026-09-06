import * as firebase from "eslint-plugin-firebase";

export default [
  {
    plugins: {
      firebase
    },
    files: ["firestore.rules"],
    processor: "firebase/rules",
    rules: {
      "firebase/no-open-read": "warn",
      "firebase/no-open-write": "warn"
    }
  }
];
