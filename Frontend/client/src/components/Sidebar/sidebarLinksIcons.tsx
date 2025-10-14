// components/Sidebar/sidebarLinks.tsx
import React from "react";
export const ICON_CLASSES = "w-5 h-5 transition-colors duration-150";

export const linksMain = [
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

export const linksTest = [
  {
    name: "Test templates",
    to: "/templates",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6M9 15h6" />
      </svg>
    ),
  },
  {
    name: "Tests",
    to: "/tests",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    name: "Results",
    to: "/results",
    icon: (
      <svg className={ICON_CLASSES} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
];

export const LogoutIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H9m9 0l-3-3m3 3l-3 3" />
  </svg>
);

export const HamburgerIcon = (
  <svg className="w-7 h-7" fill="none" stroke="#4fd1c5" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
