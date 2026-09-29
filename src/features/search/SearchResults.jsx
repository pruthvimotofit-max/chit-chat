import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";

function SearchResults({ users, loading, query }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="explore-search-state">
        Searching...
      </div>
    );
  }

  if (query.trim() && users.length === 0) {
    return (
      <div className="explore-search-state">
        No users found.
      </div>
    );
  }

  if (!users.length) {
    return null;
  }

  return (
    <div className="explore-search-results">
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          className="explore-user-result"
          onClick={() =>
            navigate(`/profile/${user.username}`)
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
            <strong>{user.username}</strong>
            <span>{user.displayName}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export default SearchResults;
