import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Camera,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useAuth } from "../features/auth/AuthProvider";
import { createComment, getCommentCount, getComments } from "../services/comments/commentService";
import {
  hasLikedComment,
  likeComment,
  unlikeComment,
} from "../services/comments/commentLikeService";
import {
  createCommentReply,
  getCommentReplies,
} from "../services/comments/commentReplyService";
import { getUserById } from "../services/users/userService";
import {
  hasSavedPost,
  savePost,
  unsavePost,
} from "../services/saves/saveService";
import {
  getLikeCount,
  hasLikedPost,
  likePost,
  unlikePost,
} from "../services/likes/likeService";

import {
  getShareCount,
  recordShare,
} from "../services/shares/shareService";

const demoReels = [
  {
    id: "reel-1",
    username: "chitchat",
    displayName: "Chit Chat",
    avatar: "https://i.pravatar.cc/100?img=12",
    caption: "Welcome to Chit Chat ✨ Share your moments with the world.",
    audio: "Original audio",
    videoUrl:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    likes: 12400,
    comments: 320,
    shares: 1100,
  },
  {
    id: "reel-2",
    username: "travel.with.me",
    displayName: "Travel With Me",
    avatar: "https://i.pravatar.cc/100?img=32",
    caption: "Chasing sunsets, finding peace 🌅",
    audio: "Original audio",
    videoUrl:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    likes: 8420,
    comments: 186,
    shares: 640,
  },
  {
    id: "reel-3",
    username: "daily.motion",
    displayName: "Daily Motion",
    avatar: "https://i.pravatar.cc/100?img=47",
    caption: "Somewhere between the road and the destination.",
    audio: "Original audio",
    videoUrl:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    likes: 5310,
    comments: 94,
    shares: 420,
  },
];

function formatCount(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value;
}

function CommentsPanel({ reel, user, onClose }) {
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

        const result = await getComments(reel.id);

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
                reel.id,
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
                  postId: reel.id,
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
  }, [reel.id, user?.uid]);

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
          postId: reel.id,
          commentId: comment.id,
          userId: user.uid,
        });
      } else {
        await likeComment({
          postId: reel.id,
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
          postId: reel.id,
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
          postId: reel.id,
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
      </aside>
    </div>
  );
}


function ReelActions({ reel, onComments }) {
  const { user } = useAuth();

  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(true);

  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(true);
  const [shared, setShared] = useState(false);

  const [likeCount, setLikeCount] = useState(null);
  const [commentCount, setCommentCount] = useState(null);
  const [shareCount, setShareCount] = useState(null);

  // Load real Reel counts from Firebase.
  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      if (!reel?.id) {
        if (!cancelled) {
          setLikeCount(0);
          setCommentCount(0);
          setShareCount(0);
        }
        return;
      }

      try {
        const [likes, comments, shares] = await Promise.all([
          getLikeCount(reel.id),
          getCommentCount(reel.id),
          getShareCount(reel.id),
        ]);

        if (!cancelled) {
          setLikeCount(likes);
          setCommentCount(comments);
          setShareCount(shares);
        }
      } catch (error) {
        console.error("Failed to load Reel counts:", error);

        if (!cancelled) {
          setLikeCount(0);
          setCommentCount(0);
          setShareCount(0);
        }
      }
    }

    loadCounts();

    return () => {
      cancelled = true;
    };
  }, [reel?.id]);

  // Load the real save state from Firebase.
  useEffect(() => {
    let cancelled = false;

    async function loadSaveState() {
      if (!user?.uid || !reel?.id) {
        if (!cancelled) {
          setSaved(false);
          setSaveLoading(false);
        }
        return;
      }

      try {
        setSaveLoading(true);

        const isSaved = await hasSavedPost(
          reel.id,
          user.uid,
        );

        if (!cancelled) {
          setSaved(isSaved);
        }
      } catch (error) {
        console.error(
          "Failed to load Reel save state:",
          error,
        );

        if (!cancelled) {
          setSaved(false);
        }
      } finally {
        if (!cancelled) {
          setSaveLoading(false);
        }
      }
    }

    loadSaveState();

    return () => {
      cancelled = true;
    };
  }, [reel?.id, user?.uid]);

  async function handleSave() {
    if (!user?.uid || !reel?.id || saveLoading) {
      return;
    }

    const previousSaved = saved;

    // Optimistic UI.
    setSaved(!previousSaved);
    setSaveLoading(true);

    try {
      if (previousSaved) {
        await unsavePost(reel.id, user.uid);
      } else {
        await savePost(reel.id, user.uid);
      }
    } catch (error) {
      console.error(
        "Failed to update Reel save:",
        error,
      );

      // Roll back if Firebase fails.
      setSaved(previousSaved);
    } finally {
      setSaveLoading(false);
    }
  }

  // Load the real like state from Firebase.
  useEffect(() => {
    let cancelled = false;

    async function loadLikeState() {
      if (!user?.uid || !reel?.id) {
        if (!cancelled) {
          setLiked(false);
          setLikeLoading(false);
        }
        return;
      }

      try {
        setLikeLoading(true);

        const isLiked = await hasLikedPost(
          reel.id,
          user.uid,
        );

        if (!cancelled) {
          setLiked(isLiked);
        }
      } catch (error) {
        console.error(
          "Failed to load Reel like:",
          error,
        );

        if (!cancelled) {
          setLiked(false);
        }
      } finally {
        if (!cancelled) {
          setLikeLoading(false);
        }
      }
    }

    loadLikeState();

    return () => {
      cancelled = true;
    };
  }, [reel?.id, user?.uid]);

  async function handleLike() {
    if (!user?.uid || !reel?.id || likeLoading) {
      return;
    }

    const previousLiked = liked;
    const nextLiked = !previousLiked;

    // Instant UI response.
    setLiked(nextLiked);
    setLikeLoading(true);

    try {
      if (nextLiked) {
        await likePost(reel.id, user.uid);
      } else {
        await unlikePost(reel.id, user.uid);
      }
    } catch (error) {
      console.error(
        "Failed to update Reel like:",
        error,
      );

      // Roll back if Firebase fails.
      setLiked(previousLiked);
    } finally {
      setLikeLoading(false);
    }
  }

  async function handleShare() {
    if (!user?.uid || !reel?.id) {
      return;
    }

    const shareUrl = `${window.location.origin}/reels/${reel.id}`;

    try {
      let shareMethod = null;

      if (navigator.share) {
        await navigator.share({
          title: "Chit Chat Reel",
          text: reel.caption,
          url: shareUrl,
        });

        shareMethod = "native";
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);

        shareMethod = "copy_link";
      }

      if (shareMethod) {
        await recordShare({
          postId: reel.id,
          userId: user.uid,
          method: shareMethod,
        });

        setShared(true);

        window.setTimeout(() => {
          setShared(false);
        }, 1800);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Share failed:", error);
      }
    }
  }

  return (
    <div className="reels-actions">
      <button
        type="button"
        className={`reels-action ${liked ? "liked" : ""}`}
        onClick={handleLike}
        disabled={likeLoading}
        aria-label={liked ? "Unlike" : "Like"}
      >
        <Heart
          size={28}
          strokeWidth={2.1}
          fill={liked ? "currentColor" : "none"}
        />

        <span>
          {likeCount === null ? "..." : formatCount(likeCount)}
        </span>
      </button>

      <button
        type="button"
        className="reels-action"
        onClick={onComments}
        aria-label="Comments"
      >
        <MessageCircle
          size={28}
          strokeWidth={2.1}
        />

        <span>
          {commentCount === null ? "..." : formatCount(commentCount)}
        </span>
      </button>

      <button
        type="button"
        className="reels-action"
        onClick={handleShare}
        aria-label="Share"
      >
        <Send
          size={27}
          strokeWidth={2.1}
        />

        <span>
          {shared
            ? "Shared"
            : shareCount === null
              ? "..."
              : formatCount(shareCount)}
        </span>
      </button>

      <button
        type="button"
        className={`reels-action ${
          saved ? "saved" : ""
        }`}
        onClick={handleSave}
        disabled={saveLoading}
        aria-label={saved ? "Unsave" : "Save"}
      >
        <Bookmark
          size={28}
          strokeWidth={2.1}
          fill={saved ? "currentColor" : "none"}
        />

        <span>
          {saved ? "Saved" : "Save"}
        </span>
      </button>

      <button
        type="button"
        className="reels-action reels-more"
        onClick={() =>
          alert("More options are coming next.")
        }
        aria-label="More options"
      >
        <MoreHorizontal size={27} />
      </button>
    </div>
  );
}

function ReelCard({ reel, active, onComments }) {
  const videoRef = useRef(null);

  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    video.muted = muted;

    if (active) {
      video
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  }, [active, muted]);

  function togglePlay() {
    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {
      video
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <article className="reels-item">
      <div className="reels-video-container">
        <video
          ref={videoRef}
          className="reels-video"
          src={reel.videoUrl}
          loop
          playsInline
          muted={muted}
          preload="metadata"
          controls={false}
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />

        <div className="reels-overlay" />

        <button
          type="button"
          className="reels-mute-button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>

        {!playing && (
          <button
            type="button"
            className="reels-play-button"
            onClick={togglePlay}
            aria-label="Play"
          >
            <Play size={34} fill="currentColor" />
          </button>
        )}

        <div className="reels-info">
          <div className="reels-profile-row">
            <img
              src={reel.avatar}
              alt=""
              className="reels-avatar"
            />

            <button
              type="button"
              className="reels-username"
            >
              {reel.username}
            </button>

            <span className="reels-dot">•</span>

            <button
              type="button"
              className={`reels-follow-button ${
                following ? "following" : ""
              }`}
              onClick={() =>
                setFollowing((value) => !value)
              }
            >
              {following ? "Following" : "Follow"}
            </button>
          </div>

          <p className="reels-caption">
            {reel.caption}
          </p>

          <div className="reels-audio">
            <span className="reels-music">♫</span>
            <span>{reel.audio}</span>
          </div>
        </div>

        <div className="reels-mobile-actions">
          <ReelActions
            reel={reel}
            onComments={() => onComments(reel)}
          />
        </div>
      </div>

      <div className="reels-desktop-actions">
        <ReelActions
          reel={reel}
          onComments={() => onComments(reel)}
        />
      </div>
    </article>
  );
}

function ReelsPage() {
  const { user } = useAuth();

  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsReel, setCommentsReel] = useState(null);

  useEffect(() => {
    const items = document.querySelectorAll(".reels-item");

    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio -
              a.intersectionRatio
          )[0];

        if (!visibleEntry) return;

        const index = [...items].indexOf(
          visibleEntry.target
        );

        if (index >= 0) {
          setActiveIndex(index);
        }
      },
      {
        threshold: [0.5, 0.75, 0.9],
      }
    );

    items.forEach((item) =>
      observer.observe(item)
    );

    return () => observer.disconnect();
  }, []);

  return (
    <main className="reels-page">
      <div className="reels-header">
        <h1>Reels</h1>

        <button
          type="button"
          className="reels-camera-button"
          onClick={() =>
            (window.location.href =
              "/create?type=reel")
          }
          aria-label="Create reel"
        >
          <Camera size={23} />
        </button>
      </div>

      <section className="reels-feed">
        {demoReels.map((reel, index) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            active={index === activeIndex}
            onComments={setCommentsReel}
          />
        ))}
      </section>

      {commentsReel && (
        <CommentsPanel
          reel={commentsReel}
          user={user}
          onClose={() => setCommentsReel(null)}
        />
      )}
    </main>
  );
}

export default ReelsPage;
