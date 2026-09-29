import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import PostCard from "../components/social/PostCard";
import { getPostById } from "../services/posts/postService";
import { getUserById } from "../services/users/userService";

function getMediaUrl(post) {
  const media = post?.media?.[0];

  return (
    (typeof media === "string" ? media : media?.url) ||
    post?.imageUrl ||
    post?.videoUrl ||
    ""
  );
}

function PostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const [post, setPost] = useState(null);
  const [author, setAuthor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPost() {
      if (!id) {
        setError("Post not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const postData = await getPostById(id);

        let authorData = null;

        if (postData.authorId) {
          try {
            authorData = await getUserById(postData.authorId);
          } catch (authorError) {
            console.error(
              "Failed to load post author:",
              authorError,
            );
          }
        }

        if (mounted) {
          setPost(postData);
          setAuthor(authorData);
        }
      } catch (loadError) {
        console.error("Failed to load post:", loadError);

        if (mounted) {
          setError("Post not found.");
          setPost(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPost();

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="cc-post-detail-page">
        <div className="cc-post-detail-state">
          Loading post...
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="cc-post-detail-page">
        <div className="cc-post-detail-state">
          <h2>Post not found</h2>
          <p>{error || "This post could not be loaded."}</p>
          <button
            type="button"
            onClick={() => navigate("/explore")}
          >
            Back to Search
          </button>
        </div>
      </main>
    );
  }

  const username =
    author?.username ||
    "unknown";

  const initial =
    author?.displayName?.charAt(0)?.toUpperCase() ||
    author?.username?.charAt(0)?.toUpperCase() ||
    "C";

  return (
    <main className="cc-post-detail-page">
      <div className="cc-post-detail-header">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={22} />
        </button>

        <strong>Post</strong>
      </div>

      <div className="cc-post-detail-card">
        <PostCard
          id={post.id}
          authorId={post.authorId}
          username={username}
          location={post.location || ""}
          initial={initial}
          image={getMediaUrl(post)}
        isArchived={post.isArchived === true}
          likes={post.likesCount || 0}
          caption={post.caption || ""}
          comments={post.commentsCount || 0}
          time="Just now"
          onDeleted={() => navigate(-1)}
        />
      </div>
    </main>
  );
}

export default PostDetailPage;
