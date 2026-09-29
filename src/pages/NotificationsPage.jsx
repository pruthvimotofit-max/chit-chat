import { Bell, Check, CheckCheck, Heart, MessageCircle, UserPlus, AtSign } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
} from "../services/notifications/notificationService";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "like", label: "Likes" },
  { key: "comment", label: "Comments" },
  { key: "follow", label: "Follows" },
  { key: "mention", label: "Mentions" },
  { key: "message", label: "Messages" },
];

function formatNotificationTime(timestamp) {
  if (!timestamp?.toDate) return "";

  return timestamp.toDate().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getNotificationIcon(type) {
  if (type?.includes("like")) return Heart;
  if (type?.includes("comment")) return MessageCircle;
  if (type?.includes("follow")) return UserPlus;
  if (type?.includes("mention")) return AtSign;
  return Bell;
}

function getNotificationCategory(type) {
  if (type?.includes("like")) return "like";
  if (type?.includes("comment")) return "comment";
  if (type?.includes("follow")) return "follow";
  if (type?.includes("mention")) return "mention";
  if (type?.includes("message")) return "message";
  return "all";
}

function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribe = subscribeToNotifications(
      user.uid,
      (items) => {
        setNotifications(items);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user?.uid]);

  const unreadCount = notifications.filter(
    (notification) => notification.isRead !== true,
  ).length;

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") {
      return notifications;
    }

    return notifications.filter(
      (notification) =>
        getNotificationCategory(notification.type) === activeFilter,
    );
  }, [notifications, activeFilter]);

  async function handleNotificationClick(notification) {
    try {
      if (
        user?.uid &&
        notification.id &&
        !notification.isRead
      ) {
        await markNotificationAsRead(
          user.uid,
          notification.id,
        );
      }
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error,
      );
    }

    if (notification.postId) {
      if (
        notification.type === "reel" ||
        notification.type === "reel_like"
      ) {
        navigate(`/reels/${notification.postId}`);
      } else {
        navigate(`/post/${notification.postId}`);
      }
      return;
    }

    if (notification.conversationId) {
      navigate(
        `/messages/${notification.conversationId}`,
      );
      return;
    }

    if (notification.actorUsername) {
      navigate(
        `/profile/${notification.actorUsername}`,
      );
    }
  }

  async function handleMarkAllRead() {
    if (!user?.uid || markingAll || unreadCount === 0) {
      return;
    }

    try {
      setMarkingAll(true);
      await markAllNotificationsAsRead(user.uid);
    } catch (error) {
      console.error(
        "Failed to mark all notifications as read:",
        error,
      );
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="notifications-page">
      <div className="notifications-topbar">
        <div className="notifications-title-row">
          <h1>Notifications</h1>

          {unreadCount > 0 && (
            <span className="notifications-unread-count">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="notifications-mark-all"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            <CheckCheck size={18} />
            {markingAll ? "Marking..." : "Mark all as read"}
          </button>
        )}
      </div>

      <div className="notifications-filters">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`notifications-filter ${
              activeFilter === filter.key ? "active" : ""
            }`}
            onClick={() => setActiveFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <section className="notifications-list">
        {loading ? (
          <div className="notifications-loading">
            <div className="notifications-spinner" />
            <span>Loading notifications...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">
              <Bell size={42} strokeWidth={1.7} />
            </div>

            <h2>
              {activeFilter === "all"
                ? "No notifications yet"
                : `No ${FILTERS.find(
                    (filter) => filter.key === activeFilter,
                  )?.label.toLowerCase()} yet`}
            </h2>

            <p>
              {activeFilter === "all"
                ? "When people interact with your posts, profile, or messages, you'll see it here."
                : "When you receive this type of activity, it will appear here."}
            </p>
          </div>
        ) : (
          <div className="notifications-items">
            {filteredNotifications.map((notification) => {
              const Icon = getNotificationIcon(
                notification.type,
              );

              return (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-item ${
                    notification.isRead ? "" : "unread"
                  }`}
                  onClick={() =>
                    handleNotificationClick(notification)
                  }
                >
                  <div className="notification-avatar">
                    {notification.actorPhotoURL ? (
                      <img
                        src={notification.actorPhotoURL}
                        alt=""
                      />
                    ) : (
                      <Icon
                        size={21}
                        strokeWidth={1.9}
                      />
                    )}
                  </div>

                  <div className="notification-content">
                    <div className="notification-message">
                      {notification.message}
                    </div>

                    <div className="notification-time">
                      {formatNotificationTime(
                        notification.createdAt,
                      )}
                    </div>
                  </div>

                  {!notification.isRead && (
                    <span
                      className="notification-unread-dot"
                      aria-label="Unread"
                    />
                  )}

                  {notification.isRead && (
                    <span className="notification-read-check">
                      <Check size={15} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default NotificationsPage;
