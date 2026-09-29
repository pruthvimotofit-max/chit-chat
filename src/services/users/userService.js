import {
  doc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

export async function getUserById(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const userRef = doc(db, "users", userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function getUserByUsername(username) {
  const normalizedUsername = username.trim().toLowerCase();

  if (!normalizedUsername) {
    throw new Error("USERNAME_REQUIRED");
  }

  const usernameRef = doc(db, "usernames", normalizedUsername);
  const usernameSnapshot = await getDoc(usernameRef);

  if (!usernameSnapshot.exists()) {
    throw new Error("USER_NOT_FOUND");
  }

  const { uid } = usernameSnapshot.data();

  return getUserById(uid);
}

export async function updateUserProfile(userId, updates) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const allowedFields = [
    "displayName",
    "photoURL",
    "bio",
    "website",
    "isPrivate",
  ];

  const safeUpdates = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      safeUpdates[field] = updates[field];
    }
  }

  safeUpdates.updatedAt = serverTimestamp();

  const userRef = doc(db, "users", userId);

  await updateDoc(userRef, safeUpdates);

  return getUserById(userId);
}

export async function searchUsersByUsername(username) {
  const normalizedUsername = username.trim().toLowerCase();

  if (!normalizedUsername) {
    return [];
  }

  const usersQuery = query(
    collection(db, "users"),
    where("username", ">=", normalizedUsername),
    where("username", "<=", normalizedUsername + "\uf8ff"),
  );

  const snapshot = await getDocs(usersQuery);

  return snapshot.docs.map((userDoc) => ({
    id: userDoc.id,
    ...userDoc.data(),
  }));
}
