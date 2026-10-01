import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { getUserById } from "../users/userService";

const NOTIFICATIONS_COLLECTION = "notifications";

function areNotificationsEnabled() {
  try {
    const saved = localStorage.getItem("chit-chat-settings");

    if (!saved) {
      return true;
    }

    const settings = JSON.parse(saved);

    return settings.notifications !== false;
  } catch {
    return true;
  }
}

function getNotificationsCollection(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  return collection(
    db,
    "users",
    userId,
    NOTIFICATIONS_COLLECTION,
  );
}

export async function createNotification({
  recipientId,
  actorId,
  type,
  message,
  postId = null,
  commentId = null,
  conversationId = null,
  storyId = null,
  actorUsername = null,
  actorPhotoURL = null,
}) {
  if (!recipientId) {
    throw new Error("RECIPIENT_ID_REQUIRED");
  }

  if (!actorId) {
    throw new Error("ACTOR_ID_REQUIRED");
  }

  if (!type) {
    throw new Error("NOTIFICATION_TYPE_REQUIRED");
  }

  if (!message?.trim()) {
    throw new Error("NOTIFICATION_MESSAGE_REQUIRED");
  }

  if (recipientId === actorId) {
    return null;
  }

  if (!areNotificationsEnabled()) {
    return null;
  }

  let resolvedActorUsername = actorUsername;
  let resolvedActorPhotoURL = actorPhotoURL;

  if (
    actorId &&
    (!resolvedActorUsername || !resolvedActorPhotoURL)
  ) {
    try {
      const actor = await getUserById(actorId);

      resolvedActorUsername =
        resolvedActorUsername ||
        actor.username ||
        null;

      resolvedActorPhotoURL =
        resolvedActorPhotoURL ||
        actor.photoURL ||
        null;
    } catch (profileError) {
      console.warn(
        "Could not enrich notification actor:",
        profileError,
      );
    }
  }

  const notificationData = {
    recipientId,
    actorId,
    type,
    message: message.trim(),
    postId,
    commentId,
    conversationId,
    storyId,
    actorUsername: resolvedActorUsername,
    actorPhotoURL: resolvedActorPhotoURL,
    isRead: false,
    createdAt: serverTimestamp(),
  };

  const notificationRef = await addDoc(
    getNotificationsCollection(recipientId),
    notificationData,
  );

  return {
    id: notificationRef.id,
    ...notificationData,
  };
}

export function subscribeToNotifications(
  userId,
  callback,
  pageSize = 50,
) {
  const notificationsQuery = query(
    getNotificationsCollection(userId),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map(
        (notificationDoc) => ({
          id: notificationDoc.id,
          ...notificationDoc.data(),
        }),
      );

      callback(notifications);
    },
    (error) => {
      console.error(
        "Notification subscription failed:",
        error,
      );
    },
  );
}

export async function markNotificationAsRead(
  userId,
  notificationId,
) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!notificationId) {
    throw new Error("NOTIFICATION_ID_REQUIRED");
  }

  await updateDoc(
    doc(
      db,
      "users",
      userId,
      NOTIFICATIONS_COLLECTION,
      notificationId,
    ),
    {
      isRead: true,
    },
  );
}

export async function markAllNotificationsAsRead(
  userId,
) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const notificationsQuery = query(
    getNotificationsCollection(userId),
  );

  const snapshot = await getDocs(notificationsQuery);

  const unreadNotifications = snapshot.docs.filter(
    (notificationDoc) =>
      notificationDoc.data().isRead !== true,
  );

  if (!unreadNotifications.length) {
    return;
  }

  const batch = writeBatch(db);

  unreadNotifications.forEach((notificationDoc) => {
    batch.update(notificationDoc.ref, {
      isRead: true,
    });
  });

  await batch.commit();
}

export async function getUnreadNotificationCount(
  userId,
) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const notificationsQuery = query(
    getNotificationsCollection(userId),
    where("isRead", "==", false),
  );

  const snapshot = await getCountFromServer(
    notificationsQuery,
  );

  return snapshot.data().count;
}
