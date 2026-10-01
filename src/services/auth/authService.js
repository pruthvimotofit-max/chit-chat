import {
  createUserWithEmailAndPassword,
  deleteUser,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  updatePassword,
  signInWithPhoneNumber,
  signOut,
} from "firebase/auth";

import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../../config/firebase";

let phoneRecaptchaVerifier = null;

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export async function registerUser({
  email,
  password,
  username,
  displayName,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = normalizeUsername(username);
  const trimmedDisplayName = displayName.trim();

  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password,
  );

  try {
    const userRef = doc(db, "users", credential.user.uid);
    const usernameRef = doc(db, "usernames", normalizedUsername);

    await runTransaction(db, async (transaction) => {
      const usernameSnapshot = await transaction.get(usernameRef);

      if (usernameSnapshot.exists()) {
        throw new Error("USERNAME_ALREADY_TAKEN");
      }

      transaction.set(usernameRef, {
        uid: credential.user.uid,
        createdAt: serverTimestamp(),
      });

      transaction.set(userRef, {
        username: normalizedUsername,
        displayName: trimmedDisplayName,
        photoURL: "",
        bio: "",
        website: "",
        isPrivate: false,
        isVerified: false,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return credential.user;
  } catch (error) {
    await deleteUser(credential.user);
    throw error;
  }
}

export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password,
  );

  return credential.user;
}

function normalizePhoneNumber(phone) {
  const trimmed = phone.trim().replace(/[\s()-]/g, "");

  if (/^\d{10}$/.test(trimmed)) {
    return `+91${trimmed}`;
  }

  return trimmed;
}

export function isPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);

  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

export async function sendPhoneLoginCode(phone) {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!isPhoneNumber(normalizedPhone)) {
    throw new Error("INVALID_PHONE_NUMBER");
  }

  if (!phoneRecaptchaVerifier) {
    phoneRecaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "invisible",
      },
    );
  }

  const confirmationResult = await signInWithPhoneNumber(
    auth,
    normalizedPhone,
    phoneRecaptchaVerifier,
  );

  return confirmationResult;
}

export async function verifyPhoneLoginCode(
  confirmationResult,
  verificationCode,
) {
  if (!confirmationResult) {
    throw new Error("PHONE_VERIFICATION_NOT_STARTED");
  }

  const credential = await confirmationResult.confirm(
    verificationCode.trim(),
  );

  return credential.user;
}

export async function changeUserPassword(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("WEAK_PASSWORD");
  }

  if (!auth.currentUser) {
    throw new Error("USER_NOT_SIGNED_IN");
  }

  await updatePassword(auth.currentUser, newPassword);
}

export async function logoutUser() {
  await signOut(auth);
}
