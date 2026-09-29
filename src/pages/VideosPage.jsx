import { Clapperboard, RefreshCw } from "lucide-react";
import "./VideosPage.css";
import { useEffect, useState } from "react";

import PostCard from "../components/social/PostCard";
import { getPosts } from "../services/posts/postService";
import { getUserById } from "../services/users/userService";

function getMediaUrl(post) {
  return (
    post.media?.find((item) => item?.url)?.url ||
    post.videoUrl ||
    post.imageUrl ||
    ""
  );
}

function formatTime(value) {
  if (!value) return "Just now";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  if (Number.isNaN(date.getTime())) return "Just now";

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString();
}

function VideosPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadVideos() {
    try {
      setLoading(true);
      setError("");

      const posts = await getPosts(50);

      const videoPosts = posts.filter(
        (post) =>
          post.postType === "post" &&
          post.mediaType === "video",
      );

      const enriched = await Promise.all(
        videoPosts.map(async (post) => {
          let profile = null;

          try {
            profile = await getUserById(post.authorId);
          } catch (profileError) {
            console.error(
              "Failed to load video author:",
              profileError,
            );
          }

          const mediaUrl = getMediaUrl(post);

          return {
            post,
            profile,
            mediaUrl,
          };
        }),
      );

      setVideos(
        enriched.filter((item) => item.mediaUrl),
      );
    } catch (loadError) {
      console.error(
        "Failed to load videos:",
        loadError,
      );
      setVideos([]);
      setError(
        "Couldn't load videos right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVideos();
  }, []);

  return (
    <main className="cc-videos-page">
      <header className="cc-videos-header">
        <div className="cc-videos-title">
          <div className="cc-videos-title-icon">
            <Clapperboard size={22} />
          </div>
          <div>
            <h1>Videos</h1>
            <p>Long-form videos from Chit Chat.</p>
          </div>
        </div>

        <button
          type="button"
          className="cc-videos-refresh"
          onClick={loadVideos}
          disabled={loading}
          aria-label="Refresh videos"
        >
          <RefreshCw
            size={19}
            className={loading ? "is-spinning" : ""}
          />
        </button>
      </header>

      {loading ? (
        <section className="cc-videos-state">
          <div className="cc-videos-loader" />
          <strong>Loading videos</strong>
          <span>Finding the latest videos for you.</span>
        </section>
      ) : error ? (
        <section className="cc-videos-state">
          <Clapperboard size={38} />
          <strong>Something went wrong</strong>
          <span>{error}</span>
          <button
            type="button"
            onClick={loadVideos}
          >
            Try again
          </button>
        </section>
      ) : videos.length === 0 ? (
        <section className="cc-videos-state">
          <div className="cc-videos-empty-icon">
            <Clapperboard size={34} />
          </div>
          <strong>No videos yet</strong>
          <span>
            Long-form videos shared on Chit Chat will appear here.
          </span>
        </section>
      ) : (
        <section className="cc-videos-feed">
          {videos.map(({ post, profile, mediaUrl }) => (
            <PostCard
              key={post.id}
              id={post.id}
              authorId={post.authorId}
              username={
                profile?.username ||
                profile?.displayName ||
                "Chit Chat user"
              }
              location={post.location || ""}
              initial={
                (
                  profile?.displayName ||
                  profile?.username ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase()
              }
              image={mediaUrl}
              likes={post.likesCount || 0}
              caption={post.caption || ""}
              comments={post.commentsCount || 0}
              time={formatTime(post.createdAt)}
              onDeleted={(deletedPostId) =>
                setVideos((current) =>
                  current.filter(
                    ({ post: currentPost }) =>
                      currentPost.id !== deletedPostId,
                  ),
                )
              }
            />
          ))}
        </section>
      )}
    </main>
  );
}

export default VideosPage;
