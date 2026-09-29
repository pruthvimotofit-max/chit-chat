import { ChevronLeft, ChevronRight, Plus, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import {
  getActiveStories,
  recordStoryView,
} from "../../services/stories/storyService";
import { getUserById } from "../../services/users/userService";

const IMAGE_DURATION = 5000;

function getMediaUrl(story) {
  return story?.media?.[0]?.url || story?.media?.[0] || "";
}

function Stories() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [stories, setStories] = useState([]);
  const [authors, setAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadStories() {
      setLoading(true);

      try {
        const activeStories = await getActiveStories();

        if (cancelled) return;

        setStories(activeStories);

        const authorIds = [
          ...new Set(
            activeStories
              .map((story) => story.authorId)
              .filter(Boolean),
          ),
        ];

        const profiles = await Promise.all(
          authorIds.map(async (authorId) => {
            try {
              const author = await getUserById(authorId);
              return [authorId, author];
            } catch (error) {
              console.warn(
                "Could not load Story author:",
                authorId,
                error,
              );
              return [authorId, null];
            }
          }),
        );

        if (!cancelled) {
          setAuthors(Object.fromEntries(profiles));
        }
      } catch (error) {
        console.error("Failed to load Stories:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStories();

    return () => {
      cancelled = true;
    };
  }, []);

  const groupedStories = useMemo(() => {
    const groups = new Map();

    stories.forEach((story) => {
      if (!story.authorId) return;

      if (!groups.has(story.authorId)) {
        groups.set(story.authorId, []);
      }

      groups.get(story.authorId).push(story);
    });

    return Array.from(groups.entries()).map(
      ([authorId, authorStories]) => ({
        authorId,
        stories: [...authorStories].sort(
          (a, b) =>
            (a.createdAt?.toMillis?.() || 0) -
            (b.createdAt?.toMillis?.() || 0),
        ),
      }),
    );
  }, [stories]);

  const ownStories = useMemo(
    () =>
      groupedStories.find(
        (group) => group.authorId === user?.uid,
      ),
    [groupedStories, user?.uid],
  );

  const selectedGroup = useMemo(
    () =>
      groupedStories.find(
        (group) => group.authorId === selectedAuthorId,
      ),
    [groupedStories, selectedAuthorId],
  );

  const selectedStory =
    selectedGroup?.stories[selectedIndex] || null;

  function openStory(authorId) {
    const group = groupedStories.find(
      (item) => item.authorId === authorId,
    );

    if (!group?.stories?.length) return;

    setSelectedAuthorId(authorId);
    setSelectedIndex(0);
  }

  function closeViewer() {
    setSelectedAuthorId(null);
    setSelectedIndex(0);
  }

  function showPrevious() {
    if (!selectedGroup) return;

    if (selectedIndex > 0) {
      setSelectedIndex((index) => index - 1);
    }
  }

  function showNext() {
    if (!selectedGroup) return;

    if (selectedIndex < selectedGroup.stories.length - 1) {
      setSelectedIndex((index) => index + 1);
    } else {
      closeViewer();
    }
  }

  useEffect(() => {
    if (!selectedStory || !user?.uid) return;

    recordStoryView(selectedStory.id, user.uid).catch(
      (error) => {
        console.warn("Could not record Story view:", error);
      },
    );
  }, [selectedStory, user?.uid]);

  useEffect(() => {
    if (!selectedStory || selectedStory.mediaType === "video") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      showNext();
    }, IMAGE_DURATION);

    return () => window.clearTimeout(timer);
  }, [selectedStory, selectedIndex]);

  const selectedAuthor =
    selectedGroup?.authorId === user?.uid
      ? profile
      : authors[selectedGroup?.authorId];

  const selectedAuthorName =
    selectedAuthor?.displayName ||
    selectedAuthor?.username ||
    "User";

  const ownInitial =
    profile?.displayName?.charAt(0)?.toUpperCase() ||
    profile?.username?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <>
      <section
        className="cc-stories"
        aria-label="Stories"
      >
        <div className="cc-stories-list">
          <button
            type="button"
            className={`cc-story-item is-own ${
              ownStories ? "has-story" : "is-empty"
            }`}
            onClick={() => {
              if (ownStories) {
                openStory(user.uid);
              } else {
                navigate("/create?type=story");
              }
            }}
          >
            <span
              className={`cc-story-avatar-wrap ${
                ownStories ? "has-story" : "is-empty"
              }`}
            >
              <span className="cc-story-avatar">
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt=""
                  />
                ) : (
                  ownInitial
                )}
              </span>

              {!ownStories && (
                <span
                  className="cc-story-add"
                  aria-hidden="true"
                >
                  <Plus
                    size={14}
                    strokeWidth={3}
                  />
                </span>
              )}
            </span>

            <span className="cc-story-name">
              {ownStories ? "Your story" : "Your story"}
            </span>
          </button>

          {loading && (
            <div className="cc-story-loading">
              Loading...
            </div>
          )}

          {!loading &&
            groupedStories
              .filter(
                (group) => group.authorId !== user?.uid,
              )
              .map((group) => {
                const author = authors[group.authorId];

                const name =
                  author?.displayName ||
                  author?.username ||
                  "User";

                const initial =
                  name.charAt(0).toUpperCase() || "U";

                return (
                  <button
                    key={group.authorId}
                    type="button"
                    className="cc-story-item has-story"
                    onClick={() =>
                      openStory(group.authorId)
                    }
                  >
                    <span className="cc-story-avatar-wrap has-story">
                      <span className="cc-story-avatar">
                        {author?.photoURL ? (
                          <img
                            src={author.photoURL}
                            alt=""
                          />
                        ) : (
                          initial
                        )}
                      </span>
                    </span>

                    <span className="cc-story-name">
                      {name}
                    </span>
                  </button>
                );
              })}
        </div>
      </section>

      {selectedStory && selectedGroup && (
        <div
          className="cc-story-viewer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Story viewer"
          onClick={closeViewer}
        >
          <div
            className="cc-story-viewer"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="cc-story-viewer-progress">
              {selectedGroup.stories.map((story, index) => (
                <div
                  key={story.id}
                  className="cc-story-progress-segment"
                >
                  {index < selectedIndex && (
                    <span className="cc-story-progress-fill completed" />
                  )}

                  {index === selectedIndex && (
                    <span
                      key={story.id}
                      className="cc-story-progress-fill active"
                    />
                  )}
                </div>
              ))}
            </div>

            <header className="cc-story-viewer-header">
              <div className="cc-story-viewer-user">
                <div className="cc-story-viewer-avatar">
                  {selectedAuthor?.photoURL ? (
                    <img
                      src={selectedAuthor.photoURL}
                      alt=""
                    />
                  ) : (
                    selectedAuthorName
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>

                <span>{selectedAuthorName}</span>
              </div>

              <button
                type="button"
                className="cc-story-viewer-close"
                onClick={closeViewer}
                aria-label="Close Story"
              >
                <X size={22} />
              </button>
            </header>

            <div className="cc-story-viewer-media">
              {selectedStory.mediaType === "video" ? (
                <video
                  key={selectedStory.id}
                  src={getMediaUrl(selectedStory)}
                  autoPlay
                  playsInline
                  onEnded={showNext}
                />
              ) : (
                <img
                  key={selectedStory.id}
                  src={getMediaUrl(selectedStory)}
                  alt=""
                />
              )}
            </div>

            {selectedStory.caption && (
              <p className="cc-story-viewer-caption">
                {selectedStory.caption}
              </p>
            )}

            <button
              type="button"
              className="cc-story-viewer-tap previous"
              onClick={showPrevious}
              aria-label="Previous Story"
            >
              <ChevronLeft size={30} />
            </button>

            <button
              type="button"
              className="cc-story-viewer-tap next"
              onClick={showNext}
              aria-label="Next Story"
            >
              <ChevronRight size={30} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Stories;
