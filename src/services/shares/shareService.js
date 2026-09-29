import {
  addDoc,
  collection,
  getCountFromServer,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function getSharesCollection(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  return collection(db, "posts", postId, "shares");
}

export async function recordShare({
  postId,
  userId,
  method = "native",
}) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const allowedMethods = [
    "native",
    "copy_link",
    "direct_message",
    "whatsapp",
    "facebook",
    "telegram",
    "x",
    "email",
  ];

  if (!allowedMethods.includes(method)) {
    throw new Error("INVALID_SHARE_METHOD");
  }

  const shareData = {
    postId,
    userId,
    method,
    createdAt: serverTimestamp(),
  };

  const shareRef = await addDoc(
    getSharesCollection(postId),
    shareData,
  );

  return {
    id: shareRef.id,
    ...shareData,
  };
}


export async function getShareCount(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  const snapshot = await getCountFromServer(
    getSharesCollection(postId),
  );

  return snapshot.data().count;
}

export async function performShare({
  postId,
  userId,
  shareUrl,
  title,
  text,
  nativeOnlyMobile = false,
}) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!shareUrl) {
    throw new Error("SHARE_URL_REQUIRED");
  }

  let method = null;

  const canUseNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (!nativeOnlyMobile ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  if (canUseNativeShare) {
    await navigator.share({
      title: title || "Chit Chat",
      text: text || "",
      url: shareUrl,
    });

    method = "native";
  } else if (
    typeof navigator !== "undefined" &&
    navigator.clipboard
  ) {
    await navigator.clipboard.writeText(shareUrl);
    method = "copy_link";
  } else {
    throw new Error("SHARE_UNAVAILABLE");
  }

  await recordShare({
    postId,
    userId,
    method,
  });

  return {
    method,
    shareUrl,
  };
}

