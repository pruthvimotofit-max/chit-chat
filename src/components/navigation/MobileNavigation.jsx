import { Home, MessageCircle, User, Video } from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";
import { CirclePlay, Clapperboard } from "lucide-react";

function MobileNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    {
      label: "Home",
      icon: Home,
      path: "/",
    },
    {
      label: "Reels",
      icon: CirclePlay,
      path: "/reels",
    },
    {
      label: "Videos",
      icon: Clapperboard,
      path: "/videos",
    },
    {
      label: "Messages",
      icon: MessageCircle,
      path: "/messages",
    },
    {
      label: "Profile",
      icon: User,
      path: "/profile",
    },
  ];

  return (
    <nav className="mobile-navigation" aria-label="Main navigation">
      {items.map(({ label, icon: Icon, path }) => {
        const active =
          path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(path);

        return (
          <button
            key={label}
            type="button"
            className={active ? "active" : ""}
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={23} strokeWidth={active ? 2.4 : 1.9} />
          </button>
        );
      })}
    </nav>
  );
}

export default MobileNavigation;
