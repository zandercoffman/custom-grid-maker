import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Layout Grid Design Studio",
  description: "Build, layer, and export design grids as SVG/PNG",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
