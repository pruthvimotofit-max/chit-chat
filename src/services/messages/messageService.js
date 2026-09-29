import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { createNotification } from "../notifications/notificationService";
import { getUserById } from "../users/userService";

const CONVERSATIONS_COLLECTION = "conversations";

function getConversationRef(conversationId) {
  if (!conversationId) {
    throw new Error("CONVERSATION_ID_REQUIRED");
  }

  return doc(db, CONVERSATIONS_COLLECTION, conversationId);
}

function getMessagesCollection(conversationId) {
  if (!conversationId) {
    throw new Error("CONVERSATION_ID_REQUIRED");
  }

  return collection(
    db,
    CONVERSATIONS_COLLECTION,
    conversationId,
    "messages",
  );
}

function getParticipantsKey(userA, userB) {
  if (!userA || !userB) {
    throw new Error("PARTICIPANT_ID_REQUIRED");
  }

  if (userA === userB) {
    throw new Error("CANNOT_MESSAGE_SELF");
  }

  return [userA, userB].sort().join("_");
}

export async function getOrCreateConversation(
  currentUserId,
  otherUserId,
) {
  const participantsKey = getParticipantsKey(
    currentUserId,
    otherUserId,
  );

  const conversationRef = doc(
    db,
    CONVERSATIONS_COLLECTION,
    participantsKey,
  );

  const existing = await getDoc(conversationRef);

  if (existing.exists()) {
    return {
      id: existing.id,
      ...existing.data(),
    };
  }

  const conversationData = {
    participantIds: [
      currentUserId,
      otherUserId,
    ].sort(),
    participantsKey,
    lastMessage: "",
    lastMessageAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(
    conversationRef,
    conversationData,
  );

  return {
    id: conversationRef.id,
    ...conversationData,
  };
}

export function subscribeToConversations(
  userId,
  callback,
) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const conversationsQuery = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where(
      "participantIds",
      "array-contains",
      userId,
    ),
    orderBy("updatedAt", "desc"),
    limit(50),
  );

  return onSnapshot(
    conversationsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map(
          (conversationDoc) => ({
            id: conversationDoc.id,
            ...conversationDoc.data(),
          }),
        ),
      );
    },
    (error) => {
      console.error(
        "Conversation subscription failed:",
        error,
      );
    },
  );
}

export function subscribeToMessages(
  conversationId,
  callback,
) {
  const messagesQuery = query(
    getMessagesCollection(conversationId),
    orderBy("createdAt", "asc"),
    limit(100),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map(
          (messageDoc) => ({
            id: messageDoc.id,
            ...messageDoc.data(),
          }),
        ),
      );
    },
    (error) => {
      console.error(
        "Message subscription failed:",
        error,
      );
    },
  );
}

export async function sendMessage({
  conversationId,
  senderId,
  text,
  attachment = null,
}) {
  if (!conversationId) {
    throw new Error("CONVERSATION_ID_REQUIRED");
  }

  if (!senderId) {
    throw new Error("SENDER_ID_REQUIRED");
  }

  const trimmedText = text?.trim() || "";

  if (!trimmedText && !attachment) {
    throw new Error("MESSAGE_CONTENT_REQUIRED");
  }

  if (trimmedText.length > 5000) {
    throw new Error("MESSAGE_TOO_LONG");
  }

  let messageType = "text";

  if (attachment) {
    if (!attachment.url) {
      throw new Error("ATTACHMENT_URL_REQUIRED");
    }

    if (!attachment.name) {
      throw new Error("ATTACHMENT_NAME_REQUIRED");
    }

    if (!attachment.type) {
      throw new Error("ATTACHMENT_TYPE_REQUIRED");
    }

    if (
      !Number.isInteger(attachment.size) ||
      attachment.size <= 0
    ) {
      throw new Error("ATTACHMENT_SIZE_INVALID");
    }

    if (attachment.type.startsWith("image/")) {
      messageType = "image";
    } else if (attachment.type.startsWith("video/")) {
      messageType = "video";
    } else {
      messageType = "file";
    }
  }

  const messageRef = doc(
    getMessagesCollection(conversationId),
  );

  const messageData = {
    senderId,
    text: trimmedText,
    messageType,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
    ...(attachment
      ? {
          attachmentUrl: attachment.url,
          attachmentName: attachment.name,
          attachmentType: attachment.type,
          attachmentSize: attachment.size,
        }
      : {}),
  };

  const conversationRef =
    getConversationRef(conversationId);

  let recipientId = null;

  await runTransaction(db, async (transaction) => {
    const conversationSnapshot =
      await transaction.get(conversationRef);

    if (!conversationSnapshot.exists()) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }

    const conversation =
      conversationSnapshot.data();

    if (
      !conversation.participantIds?.includes(senderId)
    ) {
      throw new Error("NOT_A_CONVERSATION_PARTICIPANT");
    }

    recipientId =
      conversation.participantIds?.find(
        (participantId) =>
          participantId !== senderId,
      ) || null;

    const currentUnreadCounts =
      conversation.unreadCounts || {};

    const recipientUnreadCount = Number(
      currentUnreadCounts[recipientId] || 0,
    );

    const conversationPreview =
      trimmedText ||
      (messageType === "image"
        ? "Photo"
        : messageType === "video"
          ? "Video"
          : attachment?.name || "File");

    transaction.set(
      messageRef,
      messageData,
    );

    transaction.update(conversationRef, {
      lastMessage: conversationPreview,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageId: messageRef.id,
      unreadCounts: recipientId
        ? {
            ...currentUnreadCounts,
            [recipientId]:
              recipientUnreadCount + 1,
          }
        : currentUnreadCounts,
    });
  });

  try {
    if (recipientId) {
      let actorName = "Someone";

      try {
        const actor = await getUserById(senderId);

        actorName =
          actor.displayName ||
          actor.username ||
          "Someone";
      } catch (profileError) {
        console.warn(
          "Could not load sender profile for notification:",
          profileError,
        );
      }

      await createNotification({
        recipientId,
        actorId: senderId,
        type: "message",
        message: `${actorName} sent you a message.`,
        conversationId,
      });
    }
  } catch (notificationError) {
    console.warn(
      "Message succeeded, but notification could not be created:",
      notificationError,
    );
  }

  return {
    id: messageRef.id,
    ...messageData,
  };
}

export async function markConversationRead(
  conversationId,
  userId,
) {
  if (!conversationId) {
    throw new Error("CONVERSATION_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const conversationRef =
    getConversationRef(conversationId);

  await runTransaction(db, async (transaction) => {
    const conversationSnapshot =
      await transaction.get(conversationRef);

    if (!conversationSnapshot.exists()) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }

    const conversation =
      conversationSnapshot.data();

    const unreadCounts =
      conversation.unreadCounts || {};

    transaction.set(
      doc(
        db,
        CONVERSATIONS_COLLECTION,
        conversationId,
        "readState",
        userId,
      ),
      {
        userId,
        lastReadAt: serverTimestamp(),
      },
      { merge: true },
    );

    transaction.update(conversationRef, {
      unreadCounts: {
        ...unreadCounts,
        [userId]: 0,
      },
    });
  });
}

export function subscribeToReadState(
  conversationId,
  userId,
  callback,
) {
  if (!conversationId) {
    throw new Error("CONVERSATION_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (typeof callback !== "function") {
    throw new Error("CALLBACK_REQUIRED");
  }

  const readStateRef = doc(
    db,
    CONVERSATIONS_COLLECTION,
    conversationId,
    "readState",
    userId,
  );

  return onSnapshot(
    readStateRef,
    (snapshot) => {
      callback(
        snapshot.exists()
          ? {
              id: snapshot.id,
              ...snapshot.data(),
            }
          : null,
      );
    },
    (error) => {
      console.error(
        "Read state subscription failed:",
        error,
      );
    },
  );
}

export async function getConversationById(
  conversationId,
) {
  const snapshot = await getDoc(
    getConversationRef(conversationId),
  );

  if (!snapshot.exists()) {
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}
