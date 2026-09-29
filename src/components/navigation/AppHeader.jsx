import { Bell, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";

function AppHeader() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <header className="app-header">
      <div className="mobile-header-brand">
        <span className="mobile-header-brand-symbol">C</span>
        <span>Chit Chat</span>
      </div>

      <div className="header-actions">
        <button
          type="button"
          aria-label="Messages"
          onClick={() => navigate("/messages")}
        >
          <MessageCircle size={21} />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          onClick={() => navigate("/notifications")}
        >
          <Bell size={21} />
          <span className="notification-dot" />
        </button>

        <button
          className="header-avatar"
          type="button"
          onClick={() => navigate("/profile")}
          aria-label="Profile"
        >
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" />
          ) : (
            <span>
              {profile?.displayName?.charAt(0)?.toUpperCase() || "U"}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

export default AppHeader;
