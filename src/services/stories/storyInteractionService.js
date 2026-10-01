import {
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
} from "firebase/firestore";
import { grantStoryShareAccess } from "./storyService";

import { db } from "../../config/firebase";
import { createNotification } from "../notifications/notificationService";
import {
  getOrCreateConversation,
  sendMessage,
} from "../messages/messageService";

const STORIES_COLLECTION = "stories";

function getReactionRef(storyId, userId) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  return doc(
    db,
    STORIES_COLLECTION,
    storyId,
    "reactions",
    userId,
  );
}

function getReactionsCollection(storyId) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  return collection(
    db,
    STORIES_COLLECTION,
    storyId,
    "reactions",
  );
}

export async function hasStoryReaction(storyId, userId) {
  const snapshot = await getDoc(
    getReactionRef(storyId, userId),
  );

  return snapshot.exists();
}

export async function getStoryReactionCount(storyId) {
  const snapshot = await getCountFromServer(
    getReactionsCollection(storyId),
  );

  return snapshot.data().count;
}

export async function toggleStoryReaction({
  storyId,
  userId,
  authorId,
}) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!authorId) {
    throw new Error("AUTHOR_ID_REQUIRED");
  }

  if (userId === authorId) {
    throw new Error("CANNOT_REACT_TO_OWN_STORY");
  }

  const reactionRef = getReactionRef(storyId, userId);
  const existing = await getDoc(reactionRef);

  if (existing.exists()) {
    await deleteDoc(reactionRef);
    return false;
  }

  await setDoc(reactionRef, {
    userId,
    storyId,
    reaction: "heart",
    createdAt: serverTimestamp(),
  });

  try {
    await createNotification({
      recipientId: authorId,
      actorId: userId,
      type: "story_reaction",
      message: "Someone reacted to your story.",
      storyId,
    });
  } catch (notificationError) {
    console.warn(
      "Story reaction succeeded, but notification failed:",
      notificationError,
    );
  }

  return true;
}

export async function replyToStory({
  storyId,
  authorId,
  senderId,
  text,
}) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  if (!authorId) {
    throw new Error("AUTHOR_ID_REQUIRED");
  }

  if (!senderId) {
    throw new Error("SENDER_ID_REQUIRED");
  }

  if (senderId === authorId) {
    throw new Error("CANNOT_REPLY_TO_OWN_STORY");
  }

  const trimmedText = text?.trim() || "";

  if (!trimmedText) {
    throw new Error("STORY_REPLY_REQUIRED");
  }

  if (trimmedText.length > 1000) {
    throw new Error("STORY_REPLY_TOO_LONG");
  }

  const conversation = await getOrCreateConversation(
    senderId,
    authorId,
  );

  return sendMessage({
    conversationId: conversation.id,
    senderId,
    text: trimmedText,
    notificationMessage: "Someone replied to your story.",
    storyId,
  });
}

export async function shareStoryToUser({
  storyId,
  authorId,
  senderId,
  recipientId,
  mediaUrl,
  mediaType,
  mediaSize,
}) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  if (!authorId) {
    throw new Error("AUTHOR_ID_REQUIRED");
  }

  if (!senderId) {
    throw new Error("SENDER_ID_REQUIRED");
  }

  if (!recipientId) {
    throw new Error("RECIPIENT_ID_REQUIRED");
  }

  if (senderId === recipientId) {
    throw new Error("CANNOT_MESSAGE_SELF");
  }

  if (!mediaUrl) {
    throw new Error("STORY_MEDIA_URL_REQUIRED");
  }

  const conversation = await getOrCreateConversation(
    senderId,
    recipientId,
  );

  const normalizedMediaType =
    mediaType === "video"
      ? "video/mp4"
      : mediaType?.startsWith("image/")
        ? mediaType
        : "image/jpeg";

  const message = await sendMessage({
    conversationId: conversation.id,
    senderId,
    text: "Shared a story with you.",
    attachment: {
      url: mediaUrl,
      name: "Story",
      type: normalizedMediaType,
      size:
        Number.isInteger(mediaSize) && mediaSize > 0
          ? mediaSize
          : 1,
    },
    notificationMessage: "Someone sent you a story.",
    storyId,
  });

  await grantStoryShareAccess({
    storyId,
    recipientId,
    senderId,
    conversationId: conversation.id,
    messageId: message.id,
  });

  return message;
}
