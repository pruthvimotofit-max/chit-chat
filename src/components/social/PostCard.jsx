import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Bookmark,
  CircleCheck,
  CircleX,
  Edit3,
  Flag,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "../../features/auth/AuthProvider";
import CommentsPanel from "./CommentsPanel";
import { getCommentCount } from "../../services/comments/commentService";
import SharePanel from "./SharePanel";
import {
  getLikeCount,
  hasLikedPost,
  likePost,
  unlikePost,
} from "../../services/likes/likeService";
import {
  hasSavedPost,
  savePost,
  unsavePost,
} from "../../services/saves/saveService";

import { performShare } from "../../services/shares/shareService";
import { recordPostView } from "../../services/views/viewService";
import {
  archivePost,
  deletePost,
  getPostById,
  unarchivePost,
  updatePost,
} from "../../services/posts/postService";
import {
  createRepost,
  getRepostCount,
  hasReposted,
  removeRepost,
} from "../../services/reposts/repostService";

function PostCard({
  id,
  authorId,
  username,
  location,
  initial,
  image,
  likes,
  caption,
  comments,
  shares,
  reposts,
  initialLiked = false,
  initialSaved = false,
  initialReposted = false,
  isArchived = false,
  repostedByUsername = "",
  time,
  onDeleted,
  onArchived,
  onUpdated,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const postRef = useRef(null);

  useEffect(() => {
    setDisplayCaption(caption || "");
  }, [caption]);

  useEffect(() => {
    setDisplayLocation(location || "");
  }, [location]);

  const [liked, setLiked] = useState(initialLiked);
  const [displayCaption, setDisplayCaption] = useState(caption || "");
  const [displayLocation, setDisplayLocation] = useState(location || "");
  const [likeCount, setLikeCount] = useState(likes || 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeError, setLikeError] = useState("");

  // Read this user's actual like document directly.
  // This is authoritative and does not depend on HomePage interaction state.
  useEffect(() => {
    if (!id || !user?.uid) {
      return;
    }

    let cancelled = false;

    async function loadLikedState() {
      try {
        const actualLiked = await hasLikedPost(id, user.uid);

        if (!cancelled) {
          setLiked(actualLiked);
        }
      } catch (error) {
        console.error(
          "Failed to load current user's like state:",
          error,
        );
      }
    }

    loadLikedState();

    return () => {
      cancelled = true;
    };
  }, [id, user?.uid]);

  const [saved, setSaved] = useState(initialSaved);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!id || !user?.uid) {
      return;
    }

    let cancelled = false;

    async function loadSavedState() {
      try {
        const actualSaved = await hasSavedPost(id, user.uid);

        if (!cancelled) {
          setSaved(actualSaved);
        }
      } catch (error) {
        console.error(
          "Failed to load current user's save state:",
          error,
        );
      }
    }

    loadSavedState();

    return () => {
      cancelled = true;
    };
  }, [id, user?.uid]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreMessage, setMoreMessage] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archived, setArchived] = useState(isArchived);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editCaption, setEditCaption] = useState(caption || "");
  const [editLocation, setEditLocation] = useState(location || "");
  const [editVisibility, setEditVisibility] = useState("public");
  const [editAltText, setEditAltText] = useState("");
  const [editCommentsEnabled, setEditCommentsEnabled] = useState(true);
  const [editHideLikeCount, setEditHideLikeCount] = useState(false);
  const [editHideShareCount, setEditHideShareCount] = useState(false);

  useEffect(() => {
    setArchived(isArchived);
  }, [isArchived]);


  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(comments || 0);
  const [reposted, setReposted] = useState(initialReposted);
  const [repostCount, setRepostCount] = useState(reposts || 0);
  const [repostLoading, setRepostLoading] = useState(false);
  const [repostError, setRepostError] = useState("");

  // Always load authoritative interaction counts from Firestore.
  // Do not trust stale aggregate fields on the post document.
  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;

    async function loadAuthoritativeCounts() {
      try {
        const [actualLikes, actualComments] = await Promise.all([
          getLikeCount(id),
          getCommentCount(id),
        ]);

        if (cancelled) {
          return;
        }

        setLikeCount(actualLikes);
        setCommentCount(actualComments);
      } catch (error) {
        console.error(
          "Failed to load authoritative post counts:",
          error,
        );
      }
    }

    loadAuthoritativeCounts();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Always load the authoritative repost state and count from Firestore.
  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;

    async function loadAuthoritativeRepostState() {
      try {
        const [actualRepostCount, actualReposted] = await Promise.all([
          getRepostCount(id),
          user?.uid
            ? hasReposted({
                postId: id,
                userId: user.uid,
              })
            : Promise.resolve(false),
        ]);

        if (cancelled) {
          return;
        }

        setRepostCount(actualRepostCount);
        setReposted(actualReposted);
      } catch (error) {
        console.error(
          "Failed to load authoritative repost state:",
          error,
        );
      }
    }

    loadAuthoritativeRepostState();

    return () => {
      cancelled = true;
    };
  }, [id, user?.uid]);

  useEffect(() => {
    function handleCommentCreated(event) {
      if (event.detail?.postId !== id) {
        return;
      }

      setCommentCount((current) => current + 1);
    }

    window.addEventListener(
      "chitchat:comment-created",
      handleCommentCreated,
    );

    return () => {
      window.removeEventListener(
        "chitchat:comment-created",
        handleCommentCreated,
      );
    };
  }, [id]);

  useEffect(() => {
    function handleCommentsLoaded(event) {
      if (event.detail?.postId !== id) {
        return;
      }

      setCommentCount(event.detail.count || 0);
    }

    window.addEventListener(
      "chitchat:comments-loaded",
      handleCommentsLoaded,
    );

    return () => {
      window.removeEventListener(
        "chitchat:comments-loaded",
        handleCommentsLoaded,
      );
    };
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;

    let cancelled = false;

    async function recordView() {

      try {
        const created = await recordPostView(id, user.uid);

        if (!cancelled) {
          void created;
        }
      } catch (error) {
        console.error("VIEW ERROR:", error);
      }
    }

    recordView();

    return () => {
      cancelled = true;
    };
  }, [id, user]);






  async function handleLike() {
    if (!id || !user || likeLoading) {
      return;
    }

    setLikeError("");
    setLikeLoading(true);

    const previousState = liked;
    const previousCount = likeCount;
    const nextState = !liked;

    setLiked(nextState);
    setLikeCount((current) =>
      Math.max(0, current + (nextState ? 1 : -1)),
    );

    try {
      if (nextState) {
        await likePost(id, user.uid);
      } else {
        await unlikePost(id, user.uid);
      }

    } catch (error) {
      console.error("Failed to update like:", error);
      setLiked(previousState);
      setLikeCount(previousCount);
      setLikeError(
        error?.code
          ? `${error.code}: ${error?.message || "Like update failed."}`
          : error?.message || "Couldn't update like.",
      );
    } finally {
      setLikeLoading(false);
    }
  }

  async function handleRepost() {
    if (
      !id ||
      !user ||
      !authorId ||
      user.uid === authorId ||
      repostLoading
    ) {
      return;
    }

    setRepostError("");
    setRepostLoading(true);

    const previousState = reposted;
    const previousCount = repostCount;
    const nextState = !reposted;

    setReposted(nextState);
    setRepostCount((current) =>
      Math.max(0, current + (nextState ? 1 : -1)),
    );

    try {
      if (nextState) {
        await createRepost({
          postId: id,
          userId: user.uid,
          originalAuthorId: authorId,
        });
      } else {
        await removeRepost({
          postId: id,
          userId: user.uid,
        });
      }

    } catch (error) {
      console.error("Failed to update repost:", error);

      setReposted(previousState);
      setRepostCount(previousCount);

      setRepostError(
        error?.message === "CANNOT_REPOST_OWN_POST"
          ? "You can't repost your own post."
          : "Couldn't update repost.",
      );
    } finally {
      setRepostLoading(false);
    }
  }

  async function handleSave() {
    if (!id || !user || saveLoading) {
      return;
    }

    setSaveError("");
    setSaveLoading(true);

    const previousState = saved;
    const nextState = !saved;

    setSaved(nextState);

    try {
      if (nextState) {
        await savePost(id, user.uid);
      } else {
        await unsavePost(id, user.uid);
      }
    } catch (error) {
      console.error("Failed to update save:", error);

      setSaved(previousState);
      setSaveError("Couldn't update save.");
    } finally {
      setSaveLoading(false);
    }
  }

  function handleShare() {
    if (!id || !user) {
      return;
    }

    setSharePanelOpen(true);
  }

  function handleCommentsToggle() {
    setShowComments((current) => !current);
  }

  async function handleCopyPostLink() {
    try {
      const postUrl = `${window.location.origin}${window.location.pathname}#post-${id}`;
      await navigator.clipboard.writeText(postUrl);
      setMoreMessage("Link copied");
    } catch (error) {
      console.error("Failed to copy post link:", error);
      setMoreMessage("Couldn't copy link");
    }
    setTimeout(() => setMoreMessage(""), 1800);
  }

  function handlePostPreference(message) {
    setMoreOpen(false);
    setMoreMessage(message);
    setTimeout(() => setMoreMessage(""), 1800);
  }

  function handleReportPost() {
    setMoreOpen(false);
    setMoreMessage("Thanks. We'll review this post.");
    setTimeout(() => setMoreMessage(""), 2200);
  }

  async function openEditPost() {
    if (!id || !user || !authorId || user.uid !== authorId || editLoading) {
      return;
    }

    try {
      setEditError("");
      setEditLoading(true);

      const currentPost = await getPostById(id);

      setEditCaption(currentPost.caption || "");
      setEditLocation(currentPost.location || "");
      setEditVisibility(currentPost.visibility || "public");
      setEditAltText(currentPost.altText || "");
      setEditCommentsEnabled(currentPost.commentsEnabled !== false);
      setEditHideLikeCount(currentPost.hideLikeCount === true);
      setEditHideShareCount(currentPost.hideShareCount === true);

      setMoreOpen(false);
      setEditOpen(true);
    } catch (error) {
      console.error("Failed to load post for editing:", error);
      setMoreMessage("Couldn't open edit mode. Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleEditPost(event) {
    event?.preventDefault?.();

    if (!id || !user || !authorId || user.uid !== authorId || editLoading) {
      return;
    }

    try {
      setEditLoading(true);
      setEditError("");

      const updatedPost = await updatePost({
        postId: id,
        userId: user.uid,
        caption: editCaption,
        location: editLocation,
        visibility: editVisibility,
        altText: editAltText,
        commentsEnabled: editCommentsEnabled,
        hideLikeCount: editHideLikeCount,
        hideShareCount: editHideShareCount,
      });

      setDisplayCaption(updatedPost?.caption ?? editCaption);
      setDisplayLocation(updatedPost?.location ?? editLocation);
      onUpdated?.(updatedPost);
      setEditOpen(false);
    } catch (error) {
      console.error("Failed to update post:", error);
      setEditError(
        error?.message || "Couldn't update this post. Please try again.",
      );
    } finally {
      setEditLoading(false);
    }
  }

  async function handleArchivePost() {
    if (!id || !user || !authorId || user.uid !== authorId || archiveLoading) {
      return;
    }

    const confirmed = window.confirm(
      "Archive this post? You can restore it later from Archive.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setArchiveLoading(true);
      setMoreMessage("");
      await archivePost(id, user.uid);
      setArchived(true);
      setMoreOpen(false);
      onArchived?.(id);
    } catch (error) {
      console.error("Failed to archive post:", error);
      setMoreMessage("Couldn't archive this post. Please try again.");
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleUnarchivePost() {
    if (!id || !user || !authorId || user.uid !== authorId || archiveLoading) {
      return;
    }

    try {
      setArchiveLoading(true);
      setMoreMessage("");
      await unarchivePost(id, user.uid);
      setArchived(false);
      setMoreOpen(false);
      onArchived?.(id);
    } catch (error) {
      console.error("Failed to unarchive post:", error);
      setMoreMessage("Couldn't unarchive this post. Please try again.");
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleDeletePost() {
    if (!id || !user || !authorId || user.uid !== authorId || deleteLoading) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this post? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleteLoading(true);
      setMoreMessage("");
      await deletePost(id, user.uid);
      setMoreOpen(false);
      onDeleted?.(id);
    } catch (error) {
      console.error("Failed to delete post:", error);
      setMoreMessage("Couldn't delete this post. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <article className="post-card" ref={postRef}>
      {repostedByUsername && (
        <div className="post-repost-label">
          <Repeat2 size={15} />
          <span>{repostedByUsername} reposted</span>
        </div>
      )}

      <header className="post-header">
        <div className="post-user">
          <button
            type="button"
            className="post-avatar-button"
            aria-label={`Open ${username} profile`}
          >
            <span className="post-avatar">{initial}</span>
          </button>

          <div className="post-user-info">
            <strong>{username}</strong>
            {location && <span>{location}</span>}
          </div>
        </div>

        <button
          type="button"
          className="post-more-button"
          aria-label="More options"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={21} />
        </button>
      </header>

      {moreOpen && (
        <div
          className="post-more-backdrop"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="post-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Post options"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="post-more-handle" />

            <div className="post-more-sheet-header">
              <strong>Post options</strong>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setMoreOpen(false)}
              >
                <X size={21} />
              </button>
            </div>

            <div className="post-more-list">

              {user?.uid === authorId && (


                <button


                  type="button"


                  onClick={archived ? handleUnarchivePost : handleArchivePost}


                  disabled={archiveLoading}


                >


                  <Archive size={21} />


                  <span>


                    {archiveLoading


                      ? archived


                        ? "Unarchiving..."


                        : "Archiving..."


                      : archived


                        ? "Unarchive"


                        : "Archive"}


                  </span>


                </button>


              )}
              {user?.uid === authorId && (
                <button
                  type="button"
                  aria-label="Edit post"
                  onClick={openEditPost}
                  disabled={editLoading}
                >
                  <Edit3 size={21} />
                  <span>{editLoading ? "Opening..." : "Edit"}</span>
                </button>
              )}



              {user?.uid === authorId && (
                <button
                  type="button"
                  className="post-more-danger"
                  onClick={handleDeletePost}
                  disabled={deleteLoading}
                >
                  <Trash2 size={21} />
                  <span>{deleteLoading ? "Deleting..." : "Delete"}</span>
                </button>
              )}
              

              <button
                type="button"
                onClick={() =>
                  handlePostPreference("We'll show you more posts like this.")
                }
              >
                <CircleCheck size={21} />
                <span>Interested</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handlePostPreference("We'll show you fewer posts like this.")
                }
              >
                <CircleX size={21} />
                <span>Not interested</span>
              </button>

              <button
                type="button"
                className="post-more-danger"
                onClick={handleReportPost}
              >
                <Flag size={21} />
                <span>Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div
          className="post-more-backdrop"
          role="presentation"
          onClick={() => !editLoading && setEditOpen(false)}
        >
          <div
            className="post-more-sheet post-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit post"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="post-more-handle" />

            <div className="post-more-sheet-header">
              <div className="post-edit-title">
                <span className="post-edit-title-icon">
                  <Edit3 size={18} strokeWidth={2.2} />
                </span>
                <div>
                  <strong>Edit post</strong>
                  <span>Update how your post appears</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => !editLoading && setEditOpen(false)}
                disabled={editLoading}
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleEditPost}>
              <div style={{ display: "grid", gap: 14 }}>
                <label>
                  <span>Caption</span>
                  <textarea
                    value={editCaption}
                    onChange={(event) => setEditCaption(event.target.value)}
                    maxLength={2200}
                    rows={4}
                    disabled={editLoading}
                  />
                </label>

                <label>
                  <span>Location</span>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(event) => setEditLocation(event.target.value)}
                    maxLength={200}
                    disabled={editLoading}
                  />
                </label>

                <label>
                  <span>Visibility</span>
                  <select
                    value={editVisibility}
                    onChange={(event) => setEditVisibility(event.target.value)}
                    disabled={editLoading}
                  >
                    <option value="public">Public</option>
                    <option value="followers">Followers</option>
                    <option value="private">Private</option>
                  </select>
                </label>

                <label>
                  <span>Alt text</span>
                  <textarea
                    value={editAltText}
                    onChange={(event) => setEditAltText(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    disabled={editLoading}
                  />
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={editCommentsEnabled}
                    onChange={(event) =>
                      setEditCommentsEnabled(event.target.checked)
                    }
                    disabled={editLoading}
                  />
                  <span>Allow comments</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={editHideLikeCount}
                    onChange={(event) =>
                      setEditHideLikeCount(event.target.checked)
                    }
                    disabled={editLoading}
                  />
                  <span>Hide like count</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={editHideShareCount}
                    onChange={(event) =>
                      setEditHideShareCount(event.target.checked)
                    }
                    disabled={editLoading}
                  />
                  <span>Hide share count</span>
                </label>

                {editError && (
                  <div role="alert">
                    {editError}
                  </div>
                )}

                <button type="submit" disabled={editLoading}>
                  {editLoading ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="post-media">
        {image ? (
          image.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i) ? (
            <video
              src={image}
              controls
              playsInline
              preload="metadata"
              aria-label={displayCaption || "Post video"}
            />
          ) : (
            <img
              src={image}
              alt={displayCaption || "Post"}
              loading="lazy"
            />
          )
        ) : (
          <div className="post-media-empty">
            <span>No media available</span>
          </div>
        )}
      </div>

      <div className="post-actions">
        <div>
          <button
            type="button"
            aria-label={liked ? "Unlike" : "Like"}
            aria-pressed={liked}
            onClick={handleLike}
            disabled={likeLoading}
            className={
              liked
                ? "post-like-button liked"
                : "post-like-button"
            }
          >
            <Heart
              size={23}
              fill={liked ? "currentColor" : "none"}
            />
          </button>

          <button
            type="button"
            aria-label={`Comment${commentCount > 0 ? ` ${commentCount}` : ""}`}
            aria-expanded={showComments}
            onClick={handleCommentsToggle}
            className="post-comment-button"
          >
            <MessageCircle size={23} />
            {commentCount > 0 && (
              <span className="post-action-count">{commentCount}</span>
            )}
          </button>

          <button
            type="button"
            aria-label="Share"
            onClick={handleShare}
            disabled={shareLoading}
          >
            <Send size={22} />
          </button>
          <button
            type="button"
            aria-label={reposted ? "Undo repost" : "Repost"}
            aria-pressed={reposted}
            onClick={handleRepost}
            disabled={
              repostLoading ||
              !user ||
              !authorId ||
              user.uid === authorId
            }
            className={
              reposted
                ? "post-repost-button reposted"
                : "post-repost-button"
            }
            title={
              user?.uid === authorId
                ? "You can't repost your own post"
                : reposted
                  ? "Undo repost"
                  : "Repost"
            }
          >
            <Repeat2 size={22} />
            {repostCount > 0 && (
              <span className="post-action-count">{repostCount}</span>
            )}
          </button>
        </div>

        <button
          type="button"
          aria-label={saved ? "Unsave" : "Save"}
          aria-pressed={saved}
          onClick={handleSave}
          disabled={saveLoading}
          className={saved ? "post-save-button saved" : "post-save-button"}
        >
          <Bookmark
            size={22}
            fill={saved ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="post-body">
        <strong>{likeCount.toLocaleString()} likes</strong>

        <p>
          <strong>{username}</strong>{" "}
          {displayCaption}
        </p>

        <button
          className="comments-link"
          type="button"
          onClick={handleCommentsToggle}
        >
          {showComments
            ? commentCount > 0
              ? `Hide comments · ${commentCount} ${commentCount === 1 ? "comment" : "comments"}`
              : "Hide comments"
            : commentCount > 0
              ? `View all ${commentCount} ${commentCount === 1 ? "comment" : "comments"}`
              : "Add a comment"}
        </button>

        {showComments && (
          <CommentsPanel
            postId={id}
            user={user}
            onClose={() => setShowComments(false)}
          />
        )}

        {likeError && (
          <span className="post-action-error">
            {likeError}
          </span>
        )}

        {saveError && (
          <span className="post-action-error">
            {saveError}
          </span>
        )}
        {repostError && (
          <span className="post-action-error">
            {repostError}
          </span>
        )}

        {shareMessage && (
          <span className="post-share-message">
            {shareMessage}
          </span>
        )}

        {sharePanelOpen && (
          <SharePanel
            postId={id}
            userId={user?.uid}
            shareUrl={`${window.location.origin}/post/${id}`}
            title={`${username} on Chit Chat`}
            text={displayCaption || "Check out this post on Chit Chat"}
            onClose={() => setSharePanelOpen(false)}
            onShared={(method) => {

              const messages = {
                whatsapp: "Shared to WhatsApp",
                facebook: "Shared to Facebook",
                telegram: "Shared to Telegram",
                x: "Shared",
                email: "Email share opened",
                copy_link: "Post link copied",
                native: "Shared successfully",
              };

              setShareMessage(messages[method] || "Shared successfully");

              window.setTimeout(() => {
                setShareMessage("");
              }, 2500);
            }}
          />
        )}

        <span className="post-time">{time}</span>
      </div>
    </article>
  );
}

export default PostCard;
