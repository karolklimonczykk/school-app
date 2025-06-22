// components/Sidebar/Sidebar.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { sidebarColors } from "./sidebarColors";
import SidebarLinks from "./SidebarLinks.tsx";
import { linksMain, linksTest, LogoutIcon, HamburgerIcon } from "./sidebarLinksIcons.tsx";

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [showMobile, setShowMobile] = React.useState(false);
  const [hoverLogout, setHoverLogout] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  React.useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setShowMobile(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Wylogowanie
  const handleLogout = () => {
    localStorage.removeItem("token");
    setShowMobile(false);
    window.location.href = "/login";
  };

  const HamburgerButton = (
    <button
      className="fixed top-4 left-4 z-50 bg-white rounded-full shadow-md p-2 md:hidden"
      onClick={() => setShowMobile(true)}
      aria-label="Otwórz menu"
      type="button"
      style={{
        display: isMobile && !showMobile ? "block" : "none"
      }}
    >
      {HamburgerIcon}
    </button>
  );

  const Overlay = (
    <div
      className={`fixed inset-0 z-30 transition-opacity duration-300 ${showMobile ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      style={{ background: "rgba(0,0,0,0.16)" }}
      onClick={() => setShowMobile(false)}
    />
  );

  const sidebarClasses = [
    "fixed top-0 left-0 h-screen w-[230px] flex flex-col z-40 bg-[#f7fafc] transition-transform duration-300 ease-in-out",
    isMobile
      ? showMobile
        ? "translate-x-0"
        : "-translate-x-full"
      : "translate-x-0"
  ].join(" ");

  return (
    <>
      {HamburgerButton}
      {isMobile && Overlay}
      <aside
        className={sidebarClasses}
        style={{
          background: sidebarColors.sidebarBg,
          minHeight: "100vh",
          boxShadow: isMobile ? "0 2px 20px 2px rgba(90,170,180,.12)" : undefined,
          borderRight: "none",
        }}
      >
        {/* Logo/brand */}
        <div className="flex items-center justify-center" style={{ width: "85%", margin: "20px auto 10px auto", height: "44px" }}>
          <span className="text-xl font-bold tracking-wide flex items-center gap-2" style={{ color: sidebarColors.textActive }}>
            {/* ...SVG Logo... */}
            <span style={{ fontWeight: 700, fontSize: 19 }}>school-app</span>
          </span>
        </div>
        {/* Separator */}
        <div className="h-[0.5px] mx-auto my-2 w-[85%] relative overflow-hidden" style={{ background: "none" }}>
          <div className="absolute inset-0 w-full h-full pointer-events-none" style={{
            background: `linear-gradient(90deg, #f7fafc 0%, ${sidebarColors.separator} 15%, ${sidebarColors.separator} 85%, #f7fafc 100%)`
          }} />
        </div>
        <nav className="flex-1 flex flex-col">
          <ul className="flex flex-col gap-[14px] mt-2 mb-2">
            <SidebarLinks links={linksMain} isMain={true} onLinkClick={() => setShowMobile(false)} />
          </ul>
          <p
            className="font-bold uppercase mt-6 mb-4"
            style={{
              color: sidebarColors.textActive,
              width: "85%",
              margin: "0 auto",
              letterSpacing: "0.08em",
              fontSize: "0.8rem",
            }}
          >
            TEST PAGES
          </p>
          <ul className="flex flex-col gap-[14px] mt-6">
            <SidebarLinks links={linksTest} onLinkClick={() => setShowMobile(false)} />
          </ul>
        </nav>
        <div className="mt-auto w-full flex flex-col items-center pb-8 pt-3">
          <button
            className="group flex items-center gap-2 mx-auto rounded-xl transition font-bold text-[15px]"
            style={{
              width: "85%",
              padding: "8px 14px",
              background: hoverLogout ? sidebarColors.iconHoverBg : "transparent",
              color: hoverLogout ? sidebarColors.textHover : sidebarColors.text,
              cursor: "pointer"
            }}
            onClick={handleLogout}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
            type="button"
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-[12px] transition-all"
              style={{
                background: hoverLogout ? sidebarColors.iconHoverBg : sidebarColors.iconBg,
                color: hoverLogout ? sidebarColors.iconHover : sidebarColors.icon,
                fontSize: "17px",
                transition: "all 0.18s cubic-bezier(.5,1.5,.75,1.2)",
              }}
            >
              {LogoutIcon}
            </span>
            <span className="transition">Logout</span>
          </button>
        </div>
        {isMobile && (
          <button
            className="md:hidden absolute top-2 right-2 z-50 text-gray-400 hover:text-teal-400"
            onClick={() => setShowMobile(false)}
            aria-label="Zamknij menu"
            type="button"
          >
            <svg className="w-7 h-7" fill="none" stroke="#a6b3c4" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
