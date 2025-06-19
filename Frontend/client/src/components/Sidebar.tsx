import React from "react";
import { NavLink, useLocation } from "react-router-dom";

const colors = {
  sidebarBg: "#f7fafc",
  icon: "#4fd1c5",
  iconBg: "#fff",
  iconActive: "#f7fafc",
  iconActiveBg: "#4fd1c5",
  iconHover: "#75ebe0",        // nowy, na hover
  iconHoverBg: "#e7faf9",      // nowy, na hover
  text: "#a6b3c4",
  textActive: "#1a202c",
  textHover: "#34988e",        // nowy, na hover
  linkBg: "#fff",
  linkHoverBg: "#fafdfe",      // nowy, na hover
  separator: "#e2e8f0"
};

const ICON_CLASSES = "w-5 h-5 transition-colors duration-150";

const linksMain = [
  // ...twój kod, bez zmian
  {
    name: "Dashboard",
    to: "/dashboard",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M16 3v4M8 3v4" />
      </svg>
    ),
  },
  {
    name: "Schools",
    to: "/schools",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347M2.25 9.334A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM6.75 15v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
  },
  {
    name: "Classes",
    to: "/classes",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M16 3v4M8 3v4" />
      </svg>
    ),
  },
  {
    name: "Students",
    to: "/students",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
        <path d="M12 14c-4.418 0-8 1.79-8 4v2h16v-2c0-2.21-3.582-4-8-4Z" />
      </svg>
    ),
  },
];

const linksTest = [
  {
    name: "Test template",
    to: "",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6M9 15h6" />
      </svg>
    ),
  },
  {
    name: "Tests",
    to: "",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    name: "Results",
    to: "",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const contentWidth = "85%";
  const [hoveredIdx, setHoveredIdx] = React.useState<string | null>(null);

  const renderLinks = (links: typeof linksMain, isMain = false) =>
    links.map((link, idx) => {
      const isActive = link.to && location.pathname.startsWith(link.to);
      const isHovered = hoveredIdx === link.name;
      const isLastMain = isMain && idx === links.length - 1;

      // Ustal kolory na podstawie stanu
      let iconColor = colors.icon;
      let iconBg = colors.iconBg;
      let textColor = colors.text;
      let linkBg = "transparent";

      if (isActive) {
        iconColor = colors.iconActive;
        iconBg = colors.iconActiveBg;
        textColor = colors.textActive;
        linkBg = colors.linkBg;
      } else if (isHovered) {
        iconColor = colors.iconHover;
        iconBg = colors.iconHoverBg;
        textColor = colors.textHover;
        linkBg = colors.linkHoverBg;
      }

      return (
        <NavLink
          to={link.to || "#"}
          key={link.name}
          className="group flex items-center gap-2 mx-auto rounded-xl transition"
          style={{
            width: contentWidth,
            padding: "8px 14px",
            background: linkBg,
            marginBottom: isLastMain ? "1.4rem" : "0.65rem"
          }}
          end
          onMouseEnter={() => setHoveredIdx(link.name)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <span
            className="flex items-center justify-center w-8 h-8 rounded-[12px] border transition-all"
            style={{
              background: iconBg,
              color: iconColor,
              borderColor: "rgba(76,224,210,0.10)",
              borderWidth: "1.5px",
              fontSize: "17px",
              transition: "all 0.18s cubic-bezier(.5,1.5,.75,1.2)",
            }}
          >
            {React.cloneElement(link.icon as React.ReactElement, {
              color: iconColor,
              style: { color: iconColor },
              stroke: iconColor,
              width: 20,
              height: 20,
            })}
          </span>
          <span
            className="text-[15px] font-bold transition"
            style={{
              color: textColor,
            }}
          >
            {link.name}
          </span>
        </NavLink>
      );
    });

  return (
    <aside
      className=" top-0 left-0 h-screen w-[230px] flex flex-col z-30"
      style={{ background: colors.sidebarBg }}
    >
      {/* Logo/brand */}
      <div
        className="flex items-center justify-center"
        style={{
          width: contentWidth,
          margin: "20px auto 10px auto",
          height: "44px"
        }}
      >
        <span className="text-xl font-bold tracking-wide flex items-center gap-2" style={{ color: colors.textActive }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={colors.icon} strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347M2.25 9.334A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM6.75 15v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 19 }}>school-app</span>
        </span>
      </div>
      {/* Separator z gradientem */}
      <div
        className="h-[0.5px] mx-auto my-2 w-[85%] relative overflow-hidden"
        style={{ background: "none" }}
      >
        <div
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            background: `linear-gradient(90deg, #f7fafc 0%, ${colors.separator} 15%, ${colors.separator} 85%, #f7fafc 100%)`
          }}
        />
      </div>
      {/* Main nav */}
      <nav className="flex-1">
          <ul className="flex flex-col gap-[14px] mt-2 mb-2">{renderLinks(linksMain, true)}</ul>
        <p
          className="font-bold uppercase mt-6 mb-4"
          style={{
            color: colors.textActive,
            width: contentWidth,
            margin: "0 auto",
            letterSpacing: "0.08em",
            fontSize: "0.8rem",
          }}
        >
          TEST PAGES
        </p>
        <ul className="flex flex-col gap-[14px] mt-6">{renderLinks(linksTest)}</ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
