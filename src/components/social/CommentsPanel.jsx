import { useEffect, useState } from "react";
import { Heart, MessageCircle } from "lucide-react";

import { createComment, getComments } from "../../services/comments/commentService";
import {
  hasLikedComment,
  likeComment,
  unlikeComment,
} from "../../services/comments/commentLikeService";
import {
  createCommentReply,
  getCommentReplies,
} from "../../services/comments/commentReplyService";
import { getUserById } from "../../services/users/userService";

export default function CommentsPanel({ postId, user, onClose }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [likedComments, setLikedComments] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadComments() {
      try {
        setLoading(true);
        setError("");

        const result = await getComments(postId);

        const enriched = await Promise.all(
          result.map(async (comment) => {
            let author = null;
            let replies = [];
            let liked = false;

            try {
              author = await getUserById(comment.userId);
            } catch {
              author = null;
            }

            try {
              const replyResult = await getCommentReplies(
                postId,
                comment.id,
              );

              replies = await Promise.all(
                replyResult.map(async (reply) => {
                  try {
                    const replyAuthor = await getUserById(
                      reply.userId,
                    );

                    return {
                      ...reply,
                      author: replyAuthor,
                    };
                  } catch {
                    return {
                      ...reply,
                      author: null,
                    };
                  }
                }),
              );
            } catch (replyError) {
              console.error(
                "Failed to load replies:",
                replyError,
              );
            }

            if (user?.uid) {
              try {
                liked = await hasLikedComment({
                  postId: postId,
                  commentId: comment.id,
                  userId: user.uid,
                });
              } catch (likeError) {
                console.error(
                  "Failed to load comment like:",
                  likeError,
                );
              }
            }

            return {
              ...comment,
              author,
              replies,
              liked,
            };
          }),
        );

        if (!cancelled) {
          setComments(enriched);

          window.dispatchEvent(
            new CustomEvent("chitchat:comments-loaded", {
              detail: {
                postId: postId,
                count: enriched.length,
              },
            }),
          );

          const likeState = {};

          enriched.forEach((comment) => {
            likeState[comment.id] = Boolean(comment.liked);
          });

          setLikedComments(likeState);
        }
      } catch (loadError) {
        console.error(
          "Failed to load comments:",
          loadError,
        );

        if (!cancelled) {
          setError("Couldn't load comments.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [postId, user?.uid]);

  async function toggleCommentLike(comment) {
    if (!user?.uid) {
      return;
    }

    const wasLiked = Boolean(
      likedComments[comment.id],
    );

    setLikedComments((current) => ({
      ...current,
      [comment.id]: !wasLiked,
    }));

    try {
      if (wasLiked) {
        await unlikeComment({
          postId: postId,
          commentId: comment.id,
          userId: user.uid,
        });
      } else {
        await likeComment({
          postId: postId,
          commentId: comment.id,
          userId: user.uid,
        });
      }
    } catch (likeError) {
      console.error(
        "Failed to update comment like:",
        likeError,
      );

      setLikedComments((current) => ({
        ...current,
        [comment.id]: wasLiked,
      }));
    }
  }

  function startReply(comment) {
    const username =
      comment.author?.username ||
      comment.author?.displayName ||
      "user";

    setReplyingTo(comment);
    setText(`@${username} `);

    window.setTimeout(() => {
      document
        .querySelector(".reels-comment-input input")
        ?.focus();
    }, 50);
  }

  function cancelReply() {
    setReplyingTo(null);
    setText("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText || !user || submitting) {
      return;
    }

    const replyingComment = replyingTo;

    try {
      setSubmitting(true);
      setError("");

      if (replyingComment) {
        const newReply = await createCommentReply({
          postId: postId,
          commentId: replyingComment.id,
          userId: user.uid,
          text: trimmedText,
        });

        const replyWithAuthor = {
          ...newReply,
          author: {
            username: user.displayName || "You",
            displayName: user.displayName || "You",
            photoURL: user.photoURL || "",
          },
        };

        setComments((current) =>
          current.map((comment) =>
            comment.id === replyingComment.id
              ? {
                  ...comment,
                  replies: [
                    ...(comment.replies || []),
                    replyWithAuthor,
                  ],
                }
              : comment,
          ),
        );
      } else {
        const newComment = await createComment({
          postId: postId,
          userId: user.uid,
          text: trimmedText,
        });

        setComments((current) => [
          ...current,
          {
            ...newComment,
            author: {
              username: user.displayName || "You",
              displayName: user.displayName || "You",
              photoURL: user.photoURL || "",
            },
            replies: [],
            liked: false,
          },
        ]);
        
        window.dispatchEvent(
          new CustomEvent("chitchat:comment-created", {
            detail: { postId: postId },
          }),
        );
      }

      setText("");
      setReplyingTo(null);
    } catch (submitError) {
      console.error(
        "Failed to create comment/reply:",
        submitError,
      );

      setError(
        replyingComment
          ? "Couldn't post your reply."
          : "Couldn't post your comment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function getInitial(author) {
    return (
      author?.username ||
      author?.displayName ||
      "U"
    )
      .charAt(0)
      .toUpperCase();
  }

  function renderAvatar(
    author,
    className = "reels-comment-avatar",
  ) {
    if (author?.photoURL) {
      return (
        <img
          src={author.photoURL}
          alt=""
          className={className}
        />
      );
    }

    return (
      <div
        className={`${className} reels-comment-avatar-fallback`}
      >
        {getInitial(author)}
      </div>
    );
  }

  return (
    <div
      className="reels-comments-backdrop"
      onClick={onClose}
    >
      <aside
        className="reels-comments-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="reels-comments-handle" />

        <header className="reels-comments-header">
          <h2>Comments</h2>

          <button
            type="button"
            className="reels-comments-close"
            onClick={onClose}
            aria-label="Close comments"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form
          className="reels-comment-composer"
          onSubmit={handleSubmit}
        >
          {emojiOpen && (
            <div className="reels-emoji-picker">
              <div className="reels-emoji-grid">
                {[
                  "😀","😃","😄","😁","😆","😅","😂","🤣",
                  "😊","😇","🙂","🙃","😉","😌","😍","🥰",
                  "😘","😗","😙","😚","😋","😛","😝","😜",
                  "🤪","🤨","🧐","🤓","😎","🤩","🥳","😏",
                  "😢","😭","😤","😡","🤬","😱","😳","🤯",
                  "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
                  "🔥","✨","💯","🙏","👏","👍","👎","😂",
                  "😍","🥹","🤣","❤️‍🔥","💀","🤝","🫶","🙌",
                ].map((emoji, index) => (
                  <button
                    type="button"
                    key={`${emoji}-${index}`}
                    className="reels-emoji"
                    onClick={() => {
                      setText((current) => current + emoji);
                      setEmojiOpen(false);

                      window.setTimeout(() => {
                        document
                          .querySelector(".reels-comment-input input")
                          ?.focus();
                      }, 0);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {replyingTo && (
            <div className="reels-reply-bar">
              <span>
                Replying to{" "}
                <strong>
                  @{replyingTo.author?.username ||
                    "user"}
                </strong>
              </span>

              <button
                type="button"
                onClick={cancelReply}
              >
                Cancel
              </button>
            </div>
          )}

          <div className="reels-comment-input">
            {renderAvatar(
              user,
              "reels-composer-avatar",
            )}

            <button
              type="button"
              className={`reels-emoji-toggle ${
                emojiOpen ? "active" : ""
              }`}
              onClick={() =>
                setEmojiOpen((current) => !current)
              }
              aria-label="Add emoji"
            >
              <span>☺</span>
            </button>

            <input
              type="text"
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
              placeholder={
                replyingTo
                  ? "Write a reply..."
                  : "Add a comment..."
              }
              maxLength={1000}
              disabled={submitting}
            />

            <button
              type="submit"
              disabled={
                !text.trim() ||
                submitting ||
                !user
              }
            >
              {submitting ? "..." : "Post"}
            </button>
          </div>
        </form>
        <div className="reels-comments-list">
          {loading && (
            <div className="reels-comments-state">
              <span className="reels-comments-spinner" />
              <span>Loading comments</span>
            </div>
          )}

          {!loading && error && (
            <div className="reels-comments-state">
              <strong>Something went wrong</strong>
              <span>{error}</span>
            </div>
          )}

          {!loading &&
            !error &&
            comments.length === 0 && (
              <div className="reels-comments-state reels-comments-empty">
                <div className="reels-empty-comment-icon">
                  <MessageCircle
                    size={28}
                    strokeWidth={1.7}
                  />
                </div>

                <strong>No comments yet</strong>

                <span>
                  Start the conversation.
                </span>
              </div>
            )}

          {!loading &&
            !error &&
            comments.map((comment) => {
              const liked = Boolean(
                likedComments[comment.id],
              );

              return (
                <article
                  className="reels-comment"
                  key={comment.id}
                >
                  {renderAvatar(comment.author)}

                  <div className="reels-comment-body">
                    <div className="reels-comment-content-row">
                      <div className="reels-comment-text">
                        <span className="reels-comment-username">
                          {comment.author?.username ||
                            "User"}
                        </span>

                        <span className="reels-comment-message">
                          {comment.text}
                        </span>
                      </div>

                      <button
                        type="button"
                        className={`reels-comment-like ${
                          liked ? "liked" : ""
                        }`}
                        onClick={() =>
                          toggleCommentLike(comment)
                        }
                        aria-label={
                          liked
                            ? "Unlike comment"
                            : "Like comment"
                        }
                      >
                        <Heart
                          size={13}
                          strokeWidth={2}
                          fill={
                            liked
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                    </div>

                    <div className="reels-comment-meta">
                      <span>Just now</span>

                      <button
                        type="button"
                        onClick={() =>
                          startReply(comment)
                        }
                      >
                        Reply
                      </button>
                    </div>

                    {comment.replies?.length > 0 && (
                      <div className="reels-comment-replies">
                        {comment.replies.map((reply) => (
                          <div
                            className="reels-comment-reply"
                            key={reply.id}
                          >
                            {renderAvatar(
                              reply.author,
                              "reels-comment-reply-avatar",
                            )}

                            <div className="reels-comment-body">
                              <div className="reels-comment-text">
                                <span className="reels-comment-username">
                                  {reply.author?.username ||
                                    "User"}
                                </span>

                                <span className="reels-comment-message">
                                  {reply.text}
                                </span>
                              </div>

                              <div className="reels-comment-meta">
                                <span>Just now</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
        </div>


      </aside>
    </div>
  );
}

