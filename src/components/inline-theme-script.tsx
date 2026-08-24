"use client";

const themeScript = `(function(){try{var saved=localStorage.getItem("theme");var supportsSystem=typeof window.matchMedia==="function";var dark=saved?saved==="dark":supportsSystem?window.matchMedia("(prefers-color-scheme: dark)").matches:true;document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light"}catch(error){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}})()`;

export function InlineThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
    />
  );
}
