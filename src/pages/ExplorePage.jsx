import { Search, X, Play, User } from "lucide-react";

import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  searchContent,
  searchUsers,
} from "../services/search/searchService";

import { getExploreContent } from "../services/search/exploreService";

function getMediaUrl(item) {
  const media = item.media?.[0];

  return (
    (typeof media === "string" ? media : media?.url) ||
    item.imageUrl ||
    item.videoUrl ||
    ""
  );
}

function ExplorePage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [contentResults, setContentResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [content, setContent] = useState([]);
  const [loadingContent, setLoadingContent] = useState(true);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setUsers([]);
      setContentResults([]);
      setLoadingSearch(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setLoadingSearch(true);

        const userResults = await searchUsers(trimmedQuery);

        const contentSearchResults =
          await searchContent(
            trimmedQuery,
            100,
            userResults,
          );

        setUsers(userResults);
        setContentResults(contentSearchResults);
      } catch (error) {
        console.error(
          "Explore search failed:",
          error,
        );

        setUsers([]);
        setContentResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function loadExploreContent() {
      try {
        setLoadingContent(true);

        const results = await getExploreContent(30);

        if (!cancelled) {
          setContent(results);
        }
      } catch (error) {
        console.error(
          "Failed to load Explore content:",
          error,
        );

        if (!cancelled) {
          setContent([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingContent(false);
        }
      }
    }

    loadExploreContent();

    return () => {
      cancelled = true;
    };
  }, []);

  function clearSearch() {
    setQuery("");
  }

  function openContent(item) {
    if (
      item.searchType === "reel" ||
      item.exploreType === "reel"
    ) {
      navigate(`/reels/${item.id}`);
      return;
    }

    navigate(`/post/${item.id}`);
  }

  function openUser(user) {
    navigate(`/profile/${user.username}`);
  }

  return (
    <main className="explore-page">
      <header className="explore-header">
        <div>
          <h1>Explore</h1>
          <p>
            Discover people and content on Chit Chat.
          </p>
        </div>
      </header>

      <div className="explore-search">
        <Search size={20} />

        <input
          type="search"
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Search people or content..."
          aria-label="Search people or content"
        />

        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {query.trim() ? (
        <section className="explore-search-page">
          {loadingSearch ? (
            <div className="explore-search-state">
              Searching...
            </div>
          ) : (
            <>
              {users.length > 0 && (
                <section className="explore-result-section">
                  <div className="explore-section-heading">
                    <div>
                      <h2>People</h2>
                      <p>
                        Accounts matching your search.
                      </p>
                    </div>
                  </div>

                  <div className="explore-search-results">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="explore-user-result"
                        onClick={() =>
                          openUser(user)
                        }
                      >
                        <div className="explore-user-avatar">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt=""
                            />
                          ) : (
                            <User size={22} />
                          )}
                        </div>

                        <div className="explore-user-info">
                          <strong>
                            {user.username}
                          </strong>

                          <span>
                            {user.displayName}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {contentResults.length > 0 && (
                <section className="explore-result-section">
                  <div className="explore-section-heading">
                    <div>
                      <h2>Content</h2>
                      <p>
                        Posts and reels matching your
                        search.
                      </p>
                    </div>
                  </div>

                  <div className="explore-grid">
                    {contentResults.map((item) => {
                      const mediaUrl =
                        getMediaUrl(item);

                      return (
                        <button
                          key={`${item.searchType}-${item.id}`}
                          type="button"
                          className="explore-grid-item"
                          onClick={() =>
                            openContent(item)
                          }
                        >
                          {item.searchType ===
                          "reel" ? (
                            <video
                              src={mediaUrl}
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={mediaUrl}
                              alt=""
                              loading="lazy"
                            />
                          )}

                          <div className="explore-grid-overlay">
                            {item.searchType ===
                              "reel" && (
                              <span>
                                <Play
                                  size={18}
                                  fill="currentColor"
                                />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {users.length === 0 &&
                contentResults.length === 0 && (
                  <div className="explore-search-state">
                    No people or content found.
                  </div>
                )}
            </>
          )}
        </section>
      ) : (
        <section className="explore-discovery">
          <div className="explore-section-heading">
            <div>
              <h2>Discover</h2>
              <p>
                Fresh posts and Reels from Chit Chat.
              </p>
            </div>
          </div>

          {loadingContent ? (
            <div className="explore-search-state">
              Loading content...
            </div>
          ) : content.length === 0 ? (
            <div className="explore-search-state">
              No content to discover yet.
            </div>
          ) : (
            <div className="explore-grid">
              {content.map((item) => {
                const mediaUrl = getMediaUrl(item);

                return (
                  <button
                    key={`${item.exploreType}-${item.id}`}
                    type="button"
                    className="explore-grid-item"
                    onClick={() =>
                      openContent(item)
                    }
                  >
                    {item.exploreType === "reel" ? (
                      <video
                        src={mediaUrl}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt=""
                        loading="lazy"
                      />
                    )}

                    <div className="explore-grid-overlay">
                      {item.exploreType === "reel" && (
                        <span>
                          <Play
                            size={18}
                            fill="currentColor"
                          />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default ExplorePage;
