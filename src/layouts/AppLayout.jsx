import { Outlet } from "react-router-dom";
import AppSidebar from "../components/navigation/AppSidebar";
import MobileNavigation from "../components/navigation/MobileNavigation";

function AppLayout() {
  return (
    <div className="app-shell">
      <AppSidebar />

      <div className="app-main">
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <MobileNavigation />
    </div>
  );
}

export default AppLayout;
