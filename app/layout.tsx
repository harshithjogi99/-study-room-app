import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import HeaderAuth from "./HeaderAuth";
import ThemeToggle from "./ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Study Room App",
  description: "Join virtual study rooms with others",
};

// Runs before paint so the page never flashes the wrong theme on load
const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col`}
        >
          <header className="flex justify-end items-center p-4 gap-4 h-16">
            <ThemeToggle />
            <HeaderAuth />
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}