import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// No `template`: tab titles stay the bare page name ("Dashboard", "Players"). The league is
// already named in the sidebar and the favicon, so repeating it in every tab only crowds them.
export const metadata: Metadata = { title: { default: "Sleeper Fantasy Dashboard", template: "%s" }, description: "A live Sleeper fantasy football league dashboard." };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("dark", geistSans.variable, geistMono.variable, "font-sans", inter.variable)} style={{ colorScheme: "dark" }}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
