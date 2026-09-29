import { ArrowLeft, MessageCircle, Search, Send, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../features/auth/AuthProvider";
import {
  getOrCreateConversation,
  markConversationRead,
  sendMessage,
  subscribeToConversations,
  subscribeToMessages,
  subscribeToReadState,
} from "../services/messages/messageService";
import {
  getUserById,
  searchUsersByUsername,
} from "../services/users/userService";

function MessagesPage() {
  const { user, profile } = useAuth();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [conversationProfiles, setConversationProfiles] = useState({});
  const [activeConversationId, setActiveConversationId] =
    useState(conversationId || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [otherUserReadState, setOtherUserReadState] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      return undefined;
    }

    return subscribeToConversations(
      user.uid,
      setConversations,
    );
  }, [user?.uid]);

  useEffect(() => {
    setActiveConversationId(conversationId || null);
  }, [conversationId]);

  useEffect(() => {
    if (!user?.uid) {
      setConversationProfiles({});
      return undefined;
    }

    let cancelled = false;

    async function loadConversationProfiles() {
      const otherUserIds = [
        ...new Set(
          conversations
            .map((conversation) =>
              conversation.participantIds?.find(
                (id) => id !== user.uid,
              ),
            )
            .filter(Boolean),
        ),
      ];

      if (!otherUserIds.length) {
        setConversationProfiles({});
        return;
      }

      const results = await Promise.all(
        otherUserIds.map(async (userId) => {
          try {
            const result = await getUserById(userId);
            return [userId, result];
          } catch (error) {
            console.error(
              `Failed to load conversation user ${userId}:`,
              error,
            );
            return [userId, null];
          }
        }),
      );

      if (!cancelled) {
        setConversationProfiles(
          Object.fromEntries(results),
        );
      }
    }

    loadConversationProfiles();

    return () => {
      cancelled = true;
    };
  }, [conversations, user?.uid]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return undefined;
    }

    return subscribeToMessages(
      activeConversationId,
      setMessages,
    );
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !user?.uid) {
      setOtherUserReadState(null);
      return undefined;
    }

    const activeConversationForReadState =
      conversations.find(
        (conversation) =>
          conversation.id === activeConversationId,
      );

    const otherUserId =
      activeConversationForReadState?.participantIds?.find(
        (id) => id !== user.uid,
      );

    if (!otherUserId) {
      setOtherUserReadState(null);
      return undefined;
    }

    return subscribeToReadState(
      activeConversationId,
      otherUserId,
      setOtherUserReadState,
    );
  }, [
    activeConversationId,
    conversations,
    user?.uid,
  ]);

  useEffect(() => {
    if (!messages.length) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);


  useEffect(() => {
    if (!activeConversationId || !user?.uid) {
      return undefined;
    }

    let cancelled = false;

    async function markActiveConversationRead() {
      try {
        await markConversationRead(
          activeConversationId,
          user.uid,
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to mark conversation as read:",
            error,
          );
        }
      }
    }

    markActiveConversationRead();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, user?.uid]);


  function formatMessageTime(timestamp) {
    if (!timestamp) {
      return "";
    }

    const date =
      typeof timestamp?.toDate === "function"
        ? timestamp.toDate()
        : timestamp instanceof Date
          ? timestamp
          : null;

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function isMessageSeen(message) {
    if (
      !message?.senderId ||
      message.senderId !== user?.uid
    ) {
      return false;
    }

    const lastReadAt =
      otherUserReadState?.lastReadAt;

    if (!lastReadAt || !message.createdAt) {
      return false;
    }

    const readMillis =
      typeof lastReadAt?.toMillis === "function"
        ? lastReadAt.toMillis()
        : 0;

    const messageMillis =
      typeof message.createdAt?.toMillis === "function"
        ? message.createdAt.toMillis()
        : 0;

    return (
      readMillis > 0 &&
      messageMillis > 0 &&
      readMillis >= messageMillis
    );
  }

  const filteredConversations = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value || showNewMessage) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const otherUserId =
        conversation.participantIds?.find(
          (id) => id !== user?.uid,
        );

      const otherUser =
        conversationProfiles[otherUserId] || null;

      const lastMessage =
        conversation.lastMessage?.toLowerCase() || "";

      const username =
        otherUser?.username?.toLowerCase() || "";

      const displayName =
        otherUser?.displayName?.toLowerCase() || "";

      return (
        lastMessage.includes(value) ||
        username.includes(value) ||
        displayName.includes(value)
      );
    });
  }, [
    conversations,
    conversationProfiles,
    search,
    showNewMessage,
    user?.uid,
  ]);

  async function handleSendMessage(event) {
    event.preventDefault();

    if (
      !user?.uid ||
      !activeConversationId ||
      !text.trim() ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);

      await sendMessage({
        conversationId: activeConversationId,
        senderId: user.uid,
        text,
      });

      setText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  async function handleUserSearch(value) {
    setSearch(value);

    const trimmed = value.trim();

    if (!trimmed) {
      setUserResults([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const results = await searchUsersByUsername(trimmed);

      setUserResults(
        results.filter((result) => result.id !== user?.uid),
      );
    } catch (error) {
      console.error("User search failed:", error);
      setUserResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }

  async function handleStartConversation(otherUser) {
    if (!user?.uid || !otherUser?.id) {
      return;
    }

    try {
      const conversation =
        await getOrCreateConversation(
          user.uid,
          otherUser.id,
        );

      setActiveConversationId(conversation.id);
      navigate(`/messages/${conversation.id}`);
      setShowNewMessage(false);
      setSearch("");
      setUserResults([]);
    } catch (error) {
      console.error(
        "Failed to create conversation:",
        error,
      );
    }
  }

  const activeConversation =
    conversations.find(
      (conversation) =>
        conversation.id === activeConversationId,
    );

  return (
    <main className="messages-page">
      <section className={`messages-shell ${activeConversationId ? "chat-open" : ""}`}>
        <aside className="messages-sidebar">
          <div className="messages-sidebar-header">
            <div>
              <h1>Messages</h1>
              <span>
                {profile?.username || user?.email}
              </span>
            </div>

            <button
              type="button"
              className="messages-new-button"
              onClick={() => {
                setShowNewMessage(true);
                setSearch("");
                setUserResults([]);
              }}
              aria-label="New message"
            >
              <Send size={20} />
            </button>
          </div>

          <div className="messages-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => {
                const value = event.target.value;

                if (showNewMessage) {
                  handleUserSearch(value);
                } else {
                  setSearch(value);
                }
              }}
              placeholder={
                showNewMessage
                  ? "Search people..."
                  : "Search conversations"
              }
              aria-label={
                showNewMessage
                  ? "Search people"
                  : "Search conversations"
              }
            />
            {showNewMessage && search && (
              <button
                type="button"
                className="messages-search-clear"
                onClick={() => {
                  setSearch("");
                  setUserResults([]);
                }}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {showNewMessage && (
            <div className="messages-new-message-panel">
              <div className="messages-new-message-title">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewMessage(false);
                    setSearch("");
                    setUserResults([]);
                  }}
                  aria-label="Close new message"
                >
                  <ArrowLeft size={18} />
                </button>

                <strong>New message</strong>
              </div>

              {searchingUsers ? (
                <div className="messages-user-state">
                  Searching...
                </div>
              ) : search.trim() && userResults.length === 0 ? (
                <div className="messages-user-state">
                  No users found.
                </div>
              ) : (
                <div className="messages-user-results">
                  {userResults.map((result) => (
                    <button
                      type="button"
                      key={result.id}
                      className="messages-user-result"
                      onClick={() =>
                        handleStartConversation(result)
                      }
                    >
                      <div className="message-avatar">
                        {result.photoURL ? (
                          <img
                            src={result.photoURL}
                            alt=""
                          />
                        ) : (
                          result.username
                            ?.slice(0, 1)
                            .toUpperCase()
                        )}
                      </div>

                      <div>
                        <strong>
                          {result.username}
                        </strong>
                        <span>
                          {result.displayName}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="messages-conversations">
            {filteredConversations.length === 0 ? (
              <div className="messages-no-conversations">
                <MessageCircle size={30} />
                <strong>No messages yet</strong>
                <span>
                  Start a conversation to see it here.
                </span>
              </div>
            ) : (
              filteredConversations.map(
                (conversation) => {
                  const otherUserId =
                    conversation.participantIds?.find(
                      (id) => id !== user?.uid,
                    );

                  const otherUser =
                    conversationProfiles[otherUserId] || null;

                  return (
                    <button
                      type="button"
                      key={conversation.id}
                      className={`message-conversation ${
                        activeConversationId ===
                        conversation.id
                          ? "active"
                          : ""
                      }`}
                      onClick={() => {
                        setActiveConversationId(
                          conversation.id,
                        );
                        navigate(
                          `/messages/${conversation.id}`,
                        );
                      }}
                    >
                      <div className="message-avatar">
                        {otherUser?.photoURL ? (
                          <img
                            src={otherUser.photoURL}
                            alt=""
                          />
                        ) : (
                          otherUser?.displayName
                            ?.slice(0, 1)
                            .toUpperCase() ||
                          otherUser?.username
                            ?.slice(0, 1)
                            .toUpperCase() ||
                          "?"
                        )}
                      </div>

                      <div className="message-conversation-info">
                        <strong>
                          {otherUser?.displayName ||
                            otherUser?.username ||
                            otherUserId ||
                            "User"}
                        </strong>
                        <span>
                          {conversation.lastMessage ||
                            "Start chatting"}
                        </span>
                      </div>
                    </button>
                  );
                },
              )
            )}
          </div>
        </aside>

        <section className="messages-chat">
          {!activeConversation ? (
            <div className="messages-welcome">
              <div className="messages-welcome-icon">
                <MessageCircle size={34} />
              </div>

              <h2>Your messages</h2>

              <p>
                Send private messages to people on
                Chit Chat.
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowNewMessage(true);
                }}
              >
                Send message
              </button>
            </div>
          ) : (
            <>
              <header className="messages-chat-header">
                <button
                  type="button"
                  className="messages-mobile-back"
                  onClick={() => navigate("/messages")}
                  aria-label="Back to messages"
                >
                  <ArrowLeft size={20} />
                </button>
                {(() => {
                  const activeOtherUserId =
                    activeConversation.participantIds?.find(
                      (id) => id !== user?.uid,
                    );

                  const activeOtherUser =
                    conversationProfiles[activeOtherUserId] || null;

                  return (
                    <>
                      <div className="message-avatar">
                        {activeOtherUser?.photoURL ? (
                          <img
                            src={activeOtherUser.photoURL}
                            alt=""
                          />
                        ) : (
                          activeOtherUser?.displayName
                            ?.slice(0, 1)
                            .toUpperCase() ||
                          activeOtherUser?.username
                            ?.slice(0, 1)
                            .toUpperCase() ||
                          "?"
                        )}
                      </div>

                      <div>
                        <strong>
                          {activeOtherUser?.displayName ||
                            activeOtherUser?.username ||
                            activeOtherUserId ||
                            "User"}
                        </strong>

                        <span>
                          {activeOtherUser?.username
                            ? `@${activeOtherUser.username}`
                            : "Chit Chat user"}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </header>

              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="messages-empty-chat">
                    No messages yet. Say hello 👋
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine =
                      message.senderId === user?.uid;

                    return (
                      <div
                        key={message.id}
                        className={`message-row ${
                          mine ? "mine" : "theirs"
                        }`}
                      >
                        <div className="message-bubble">
                          {message.text}
                        </div>
                        <div className="message-meta">
                          {formatMessageTime(message.createdAt)}
                          {mine && isMessageSeen(message)
                            ? " · Seen"
                            : ""}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
</div>

              <form
                className="messages-composer"
                onSubmit={handleSendMessage}
              >
                <input
                  value={text}
                  onChange={(event) =>
                    setText(event.target.value)
                  }
                  placeholder="Message..."
                  maxLength={5000}
                />

                <button
                  type="submit"
                  disabled={
                    sending || !text.trim()
                  }
                  aria-label="Send message"
                >
                  <Send size={20} />
                </button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

export default MessagesPage;
