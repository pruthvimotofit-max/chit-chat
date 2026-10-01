import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import PostCard from "./PostCard";

export default function ProfilePostViewer({
  posts = [],
  initialPostId,
  profile,
  onClose,
}) {
  const feedRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const index = posts.findIndex(
      (post) => post.id === initialPostId,
    );

    if (index >= 0) {
      requestAnimationFrame(() => {
        const target = feedRef.current?.querySelector(
          `[data-post-id="${initialPostId}"]`,
        );

        target?.scrollIntoView({
          block: "start",
          behavior: "instant",
        });
      });
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [initialPostId, posts, onClose]);

  if (!posts.length) return null;

  return (
    <div className="cc-profile-post-feed-viewer">
      <button
        type="button"
        className="cc-profile-post-feed-close"
        onClick={onClose}
        aria-label="Close post viewer"
      >
        <X size={25} strokeWidth={2.2} />
      </button>

      <div
        ref={feedRef}
        className="cc-profile-post-feed-scroll"
      >
        {posts.map((post) => {
          const username =
            post.author?.username ||
            post.username ||
            profile?.username ||
            "user";

          const displayName =
            post.author?.displayName ||
            post.displayName ||
            profile?.displayName ||
            username;

          const initial =
            displayName?.charAt(0)?.toUpperCase() || "U";

          return (
            <section
              key={post.id}
              data-post-id={post.id}
              className="cc-profile-post-feed-item"
            >
              <PostCard
                id={post.id}
                authorId={post.authorId}
                username={username}
                location={post.location || ""}
                initial={initial}
                image={
                  post.media?.[0]?.url ||
                  post.media?.[0] ||
                  ""
                }
                media={post.media || []}
                isArchived={post.isArchived === true}
                isPinned={post.isPinned === true}
                likes={post.likesCount || 0}
                comments={post.commentsCount || 0}
                shares={post.sharesCount || 0}
                reposts={post.repostsCount || 0}
                caption={post.caption || ""}
                time="Just now"
                viewerMode
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
