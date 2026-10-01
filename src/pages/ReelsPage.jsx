import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import CommentsPanel from "../components/social/CommentsPanel";
import SharePanel from "../components/social/SharePanel";
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
import { getUserById, getUserByUsername } from "../services/users/userService";
import {
  followUser,
  isFollowing,
  unfollowUser,
} from "../services/follows/followService";
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
  performShare,
} from "../services/shares/shareService";

import { getEnrichedReels } from "../services/content/contentService";
import { recordPostView } from "../services/views/viewService";

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

function ReelActions({ reel, onComments, onCommentCreated }) {
  const { user } = useAuth();

    const [moreOpen, setMoreOpen] = useState(false);
const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(true);

  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(true);
  const [shared, setShared] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  const [likeCount, setLikeCount] = useState(null);
  const [commentCount, setCommentCount] = useState(null);
  const [shareCount, setShareCount] = useState(null);

  useEffect(() => {
    function handleInstantComment(event) {
      if (event.detail?.postId !== reel?.id) {
        return;
      }

      setCommentCount((current) => (current ?? 0) + 1);
    }

    window.addEventListener(
      "chitchat:comment-created",
      handleInstantComment,
    );

    return () => {
      window.removeEventListener(
        "chitchat:comment-created",
        handleInstantComment,
      );
    };
  }, [reel?.id]);


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

  function handleCommentCreated() {
    setCommentCount((current) => (current ?? 0) + 1);
  }

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

    // Update UI immediately.
    setLiked(nextLiked);
    setLikeCount((current) => {
      const currentCount = current ?? 0;
      return Math.max(
        0,
        currentCount + (nextLiked ? 1 : -1),
      );
    });
devel
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

      // Roll back both state and count.
      setLiked(previousLiked);
      setLikeCount((current) => {
        const currentCount = current ?? 0;
        return Math.max(
          0,
          currentCount + (nextLiked ? -1 : 1),
        );
      });
    } finally {
      setLikeLoading(false);
    }
  }

  async function handleShare() {
    if (!user?.uid || !reel?.id) {
      return;
    }

    const shareUrl = `${window.location.origin}/reels/${reel.id}`;
    const isMobileDevice =
      /Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent || "",
      );

    if (
      isMobileDevice &&
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        const result = await performShare({
          postId: reel.id,
          userId: user.uid,
          shareUrl,
          title: "Chit Chat Reel",
          text: reel.caption || "",
          nativeOnlyMobile: true,
        });

        if (result.method === "native") {
          setShareCount((current) => (current ?? 0) + 1);
          setShared(true);

          window.setTimeout(() => {
            setShared(false);
          }, 1800);

          return;
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        console.warn(
          "Native mobile share unavailable. Opening Chit Chat share panel.",
          error,
        );
      }
    }

    setSharePanelOpen(true);
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
        onClick={() => setMoreOpen(true)}
        aria-label="More options"
      >
        <MoreHorizontal size={27} />
      </button>

      {moreOpen && (
        <div
          className="reels-more-sheet-backdrop"
          onClick={() => setMoreOpen(false)}
        >
          <section
            className="reels-more-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Reel options"
          >
            <div className="reels-more-handle" />

            <header className="reels-more-header">
              <strong>Reel options</strong>
              <button
                type="button"
                className="reels-more-close"
                onClick={() => setMoreOpen(false)}
                aria-label="Close options"
              >
                ×
              </button>
            </header>

            <div className="reels-more-quick-actions">
              <button
                type="button"
                onClick={async () => {
                  setMoreOpen(false);
                  await handleShare();
                }}
              >
                <Send size={23} />
                <span>Share</span>
              </button>

              <button
                type="button"
                className="reels-more-report-action"
                onClick={() => {
                  setMoreOpen(false);
                }}
              >
                <span className="reels-more-report-icon">⚑</span>
                <span>Report</span>
              </button>
            </div>

            <div className="reels-more-list">
              <button
                type="button"
                onClick={async () => {
                  const shareUrl =
                    `${window.location.origin}/reels/${reel.id}`;

                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setMoreOpen(false);
                  } catch (error) {
                    console.error(
                      "Failed to copy Reel link:",
                      error,
                    );
                  }
                }}
              >
                <span className="reels-more-icon">🔗</span>
                <span>Copy link</span>
              </button>

              <button
                type="button"
                onClick={() => setMoreOpen(false)}
              >
                <span className="reels-more-icon">✨</span>
                <span>Interested</span>
              </button>

              <button
                type="button"
                onClick={() => setMoreOpen(false)}
              >
                <span className="reels-more-icon">🚫</span>
                <span>Not interested</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {sharePanelOpen && (
        <SharePanel
          postId={reel.id}
          userId={user?.uid}
          shareUrl={`${window.location.origin}/reels/${reel.id}`}
          title="Chit Chat Reel"
          text={reel.caption || ""}
          onClose={() => setSharePanelOpen(false)}
          onShared={(method) => {
            setShareCount((current) => (current ?? 0) + 1);
            setShared(true);

            window.setTimeout(() => {
              setShared(false);
            }, 1800);
          }}
        />
      )}

    </div>
  );
}

function ReelCard({ reel, active, onComments }) {
  const videoRef = useRef(null);

  const { user } = useAuth();


  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(true);
  const [targetUserId, setTargetUserId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowState() {
      if (!user?.uid || !reel?.username) {
        if (!cancelled) {
          setTargetUserId(null);
          setFollowing(false);
          setFollowLoading(false);
        }
        return;
      }

      try {
        setFollowLoading(true);

        let targetId = reel.authorId || null;

        if (!targetId) {
          const targetUser = await getUserByUsername(reel.username);
          targetId = targetUser?.id || null;
        }

        if (!targetId || targetId === user.uid) {
          if (!cancelled) {
            setTargetUserId(targetId);
            setFollowing(false);
          }
          return;
        }

        const currentFollowing = await isFollowing(
          user.uid,
          targetId,
        );

        if (!cancelled) {
          setTargetUserId(targetId);
          setFollowing(currentFollowing);
        }
      } catch (error) {
        console.error(
          "Failed to load Reel follow state:",
          error,
        );

        if (!cancelled) {
          setTargetUserId(null);
          setFollowing(false);
        }
      } finally {
        if (!cancelled) {
          setFollowLoading(false);
        }
      }
    }

    loadFollowState();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, reel?.authorId, reel?.username]);

  async function handleFollow() {
    if (
      !user?.uid ||
      !targetUserId ||
      targetUserId === user.uid ||
      followLoading
    ) {
      return;
    }

    const previousFollowing = following;
    const nextFollowing = !previousFollowing;

    // Instant UI update.
    setFollowing(nextFollowing);
    setFollowLoading(true);

    try {
      if (nextFollowing) {
        await followUser(user.uid, targetUserId);
      } else {
        await unfollowUser(user.uid, targetUserId);
      }
    } catch (error) {
      console.error(
        "Failed to update Reel follow:",
        error,
      );

      setFollowing(previousFollowing);
    } finally {
      setFollowLoading(false);
    }
  }

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
        {reel.videoUrl ? (
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
        ) : (
          <div className="reels-video-empty">
            <span>No video available</span>
          </div>
        )}

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
            {reel.avatar ? (
            <img
              src={reel.avatar}
              alt=""
              className="reels-avatar"
            />
          ) : (
            <div className="reels-avatar reels-avatar-fallback">
              {(reel.username || "U").charAt(0).toUpperCase()}
            </div>
          )}

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
                onClick={handleFollow}
                disabled={
                  followLoading ||
                  !targetUserId ||
                  targetUserId === user?.uid
                }
                aria-label={following ? "Unfollow" : "Follow"}
              >
                {followLoading
                  ? "..."
                  : following
                    ? "Following"
                    : "Follow"}
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
  const { reelId } = useParams();

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsReel, setCommentsReel] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReels() {
      try {
        setLoading(true);
        setLoadError("");

        const result = await getEnrichedReels(20);

        const enriched = result.map((reel) => {
          const author = reel.author || null;

          return {
            ...reel,
            username:
              author?.username ||
              reel.username ||
              "unknown",
            displayName:
              author?.displayName ||
              reel.displayName ||
              author?.username ||
              "Unknown user",
            avatar:
              author?.photoURL ||
              reel.avatar ||
              "",
            videoUrl:
              reel.media?.[0]?.url ||
              reel.videoUrl ||
              "",
            caption: reel.caption || "",
            audio: reel.audio || "Original audio",
          };
        });

        if (!cancelled) {
          setReels(enriched);
        
          if (reelId) {
            const selectedIndex = enriched.findIndex(
              (item) => item.id === reelId,
            );

            if (selectedIndex >= 0) {
              setActiveIndex(selectedIndex);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load Reels:", error);

        if (!cancelled) {
          setReels([]);
          setLoadError(
            error?.message ||
              "Failed to load Reels.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReels();

    return () => {
      cancelled = true;
    };
  }, []);

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
              a.intersectionRatio,
          )[0];

        if (!visibleEntry) return;

        const index = [...items].indexOf(
          visibleEntry.target,
        );

        if (index >= 0) {
          setActiveIndex(index);
        }
      },
      {
        threshold: [0.5, 0.75, 0.9],
      },
    );

    items.forEach((item) =>
      observer.observe(item),
    );

    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    if (!user?.uid || !reels.length) {
      return;
    }

    const activeReel = reels[activeIndex];

    if (!activeReel?.id) {
      return;
    }

    let cancelled = false;

    async function recordActiveReelView() {
      try {
        const recorded = await recordPostView(
          activeReel.id,
          user.uid,
        );

        if (!cancelled && recorded) {
          console.log(
            "Reel view recorded:",
            activeReel.id,
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to record Reel view:",
            error,
          );
        }
      }
    }

    recordActiveReelView();

    return () => {
      cancelled = true;
    };
  }, [activeIndex, reels, user?.uid]);

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

      {loading && (
        <div className="reels-loading">
          Loading Reels...
        </div>
      )}

      {!loading && loadError && (
        <div className="reels-loading">
          <strong>Reels are loading</strong>
          <br />
          Please try again in a moment.
        </div>
      )}

      {!loading &&
        !loadError &&
        reels.length === 0 && (
          <div className="reels-loading">
            No Reels yet.
            <br />
            Create the first Reel.
          </div>
        )}

      {!loading &&
        !loadError &&
        reels.length > 0 && (
          <section className="reels-feed">
            {reels.map((reel, index) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                active={index === activeIndex}
                onComments={setCommentsReel}
              />
            ))}
          </section>
        )}

      {commentsReel && (
        <CommentsPanel
          postId={commentsReel.id}
          user={user}
          onClose={() => setCommentsReel(null)}
        />
      )}
    </main>
  );
}
export default ReelsPage;
