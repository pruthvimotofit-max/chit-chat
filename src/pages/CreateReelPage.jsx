import { ArrowLeft, Music2, Play, Upload, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthProvider";
import { createPost } from "../services/posts/postService";
import { getMediaProviderStatus, uploadMedia } from "../services/media/mediaService";

export default function CreateReelPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [audioPreview, setAudioPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!videoFile) {
      setVideoPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  async function publishReel() {
    setError("");
    if (!user?.uid) {
      setError("Sign in before publishing a Reel.");
      return;
    }
    if (!videoFile) {
      setError("Choose a video for your Reel first.");
      return;
    }
    const providerStatus = getMediaProviderStatus();
    if (!providerStatus.ready) {
      setError(providerStatus.message || "Media storage is not configured.");
      return;
    }

    setPublishing(true);
    try {
      const video = await uploadMedia(videoFile, {
        purpose: "reel",
        userId: user.uid,
        ownerId: user.uid,
        mediaType: "video",
        allowImages: false,
        allowVideos: true,
        allowAudio: false,
        allowFiles: false,
        maxVideoSize: 100 * 1024 * 1024,
      });

      let audio = null;
      if (audioFile) {
        const uploadedAudio = await uploadMedia(audioFile, {
          purpose: "reel-audio",
          userId: user.uid,
          ownerId: user.uid,
          mediaType: "audio",
          allowImages: false,
          allowVideos: false,
          allowAudio: true,
          allowFiles: false,
          maxAudioSize: 20 * 1024 * 1024,
        });
        audio = {
          title: audioFile.name.replace(/\\.[^/.]+$/, ""),
          url: uploadedAudio.url,
          mimeType: uploadedAudio.mimeType,
          path: uploadedAudio.path,
          originalName: uploadedAudio.originalName,
        };
      }

      const post = await createPost({
        authorId: user.uid,
        caption,
        media: [video],
        mediaType: "video",
        postType: "reel",
        visibility: "public",
        audio,
      });
      if (!post?.id) throw new Error("REEL_CREATE_FAILED");
      navigate("/reels");
    } catch (publishError) {
      console.error("Reel publish failed:", publishError);
      setError(
        publishError?.message === "MEDIA_FILE_TOO_LARGE"
          ? "One of the selected files is too large."
          : publishError?.message || "Could not publish this Reel. Please try again.",
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="create-social-page">
      <div className="create-social-overlay">
        <section className="create-social-modal" aria-label="Create Reel">
          <header className="create-modal-header">
            <button type="button" className="create-header-icon" onClick={() => navigate("/reels")} aria-label="Back to Reels">
              <ArrowLeft size={20} />
            </button>
            <h1>Create Reel</h1>
            <button type="button" className="create-next-button" onClick={publishReel} disabled={publishing || !videoFile}>
              {publishing ? "Publishing…" : "Share"}
            </button>
          </header>

          <div className="create-modal-body" style={{ padding: 24, display: "grid", gap: 18 }}>
            <p style={{ margin: 0, color: "var(--cc-muted)" }}>Choose a video, add a music track if you want, then share your Reel.</p>

            {videoPreview ? (
              <div style={{ position: "relative", maxHeight: 420, background: "#111", borderRadius: 16, overflow: "hidden" }}>
                <video src={videoPreview} controls playsInline style={{ width: "100%", maxHeight: 420, display: "block" }} />
                <button type="button" className="create-header-close" onClick={() => setVideoFile(null)} aria-label="Remove video" style={{ position: "absolute", top: 10, right: 10 }}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button type="button" className="create-select-button" onClick={() => videoInputRef.current?.click()} style={{ minHeight: 180, display: "grid", placeItems: "center", gap: 10 }}>
                <Video size={34} />
                <span>Select Reel video</span>
                <small>MP4 or WebM · up to 100 MB</small>
              </button>
            )}
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" hidden onChange={(event) => setVideoFile(event.target.files?.[0] || null)} />

            <section style={{ border: "1px solid var(--cc-border)", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Music2 size={22} />
                <div style={{ flex: 1 }}>
                  <strong>Audio library</strong>
                  <div style={{ color: "var(--cc-muted)", fontSize: 13 }}>Add an audio file from your device</div>
                </div>
                <button type="button" className="create-tool-button" onClick={() => audioInputRef.current?.click()}>
                  <Upload size={16} /> Choose audio
                </button>
              </div>
              <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={(event) => setAudioFile(event.target.files?.[0] || null)} />
              {audioFile && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Play size={16} />
                    <span style={{ flex: 1, overflowWrap: "anywhere" }}>{audioFile.name}</span>
                    <button type="button" className="create-header-icon" onClick={() => setAudioFile(null)} aria-label="Remove audio"><X size={16} /></button>
                  </div>
                  <audio src={audioPreview} controls style={{ width: "100%" }} />
                </div>
              )}
              <small style={{ color: "var(--cc-muted)" }}>Use audio you have permission to share. The track is saved with the Reel and played separately; it is not permanently mixed into the video file yet.</small>
            </section>

            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Write a caption…" maxLength={2200} style={{ width: "100%", minHeight: 100, resize: "vertical", border: "1px solid var(--cc-border)", borderRadius: 12, padding: 12, font: "inherit", background: "var(--cc-surface)", color: "var(--cc-text)" }} />
            {error && <div className="create-server-error" role="alert">{error}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
