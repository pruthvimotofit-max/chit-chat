import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export async function isUsernameAvailable(username) {
  const normalizedUsername = normalizeUsername(username);
  const usernameRef = doc(db, "usernames", normalizedUsername);
  const snapshot = await getDoc(usernameRef);

  return !snapshot.exists();
}

export async function claimUsername(uid, username) {
  const normalizedUsername = normalizeUsername(username);
  const usernameRef = doc(db, "usernames", normalizedUsername);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(usernameRef);

    if (snapshot.exists()) {
      throw new Error("USERNAME_ALREADY_TAKEN");
    }

    transaction.set(usernameRef, {
      uid,
      createdAt: serverTimestamp(),
    });
  });

  return normalizedUsername;
}
