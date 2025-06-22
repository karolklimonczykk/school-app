// components/Sidebar/SidebarLinks.tsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { sidebarColors } from "./sidebarColors";

type LinkType = {
  name: string;
  to: string;
  icon: React.ReactNode;
};

interface SidebarLinksProps {
  links: LinkType[];
  isMain?: boolean;
  onLinkClick?: () => void;
}

const SidebarLinks: React.FC<SidebarLinksProps> = ({ links, isMain, onLinkClick }) => {
  const location = useLocation();
  const [hoveredIdx, setHoveredIdx] = React.useState<string | null>(null);

  return (
    <>
      {links.map((link, idx) => {
        const isActive = link.to && location.pathname.startsWith(link.to);
        const isHovered = hoveredIdx === link.name;
        const isLastMain = isMain && idx === links.length - 1;

        let iconColor = sidebarColors.icon;
        let iconBg = sidebarColors.iconBg;
        let textColor = sidebarColors.text;
        let linkBg = "transparent";

        if (isActive) {
          iconColor = sidebarColors.iconActive;
          iconBg = sidebarColors.iconActiveBg;
          textColor = sidebarColors.textActive;
          linkBg = sidebarColors.linkBg;
        } else if (isHovered) {
          iconColor = sidebarColors.iconHover;
          iconBg = sidebarColors.iconHoverBg;
          textColor = sidebarColors.textHover;
          linkBg = sidebarColors.linkHoverBg;
        }

        return (
          <NavLink
            to={link.to || "#"}
            key={link.name}
            className="group flex items-center gap-2 mx-auto rounded-xl transition"
            style={{
              width: "85%",
              padding: "8px 14px",
              background: linkBg,
              marginBottom: isLastMain ? "1.4rem" : "0.65rem"
            }}
            end
            onClick={onLinkClick}
            onMouseEnter={() => setHoveredIdx(link.name)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-[12px] transition-all"
              style={{
                background: iconBg,
                color: iconColor,
                fontSize: "17px",
                transition: "all 0.18s cubic-bezier(.5,1.5,.75,1.2)",
              }}
            >
              {React.cloneElement(
                link.icon as React.ReactElement<React.SVGProps<SVGSVGElement>>,
                {
                  stroke: iconColor,
                  width: 20,
                  height: 20,
                }
              )}
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
      })}
    </>
  );
};

export default SidebarLinks;
