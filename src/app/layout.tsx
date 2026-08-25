import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { cn } from "@/lib/utils";

// Geist is the sans everywhere and Geist Mono carries every number, so both are bound to
// the tokens the palette already reads (`--font-sans` / `--font-mono`) rather than to
// framework-generated variable names nothing references.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

// No `template`: tab titles stay the bare page name ("Dashboard", "Players"). The league is
// already named in the sidebar and the favicon, so repeating it in every tab only crowds them.
export const metadata: Metadata = { title: { default: "Sleeper Fantasy Dashboard", template: "%s" }, description: "A live Sleeper fantasy football league dashboard." };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("dark", geistSans.variable, geistMono.variable, "font-sans")} style={{ colorScheme: "dark" }}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
