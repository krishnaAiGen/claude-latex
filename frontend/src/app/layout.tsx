import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Claude LaTeX Editor",
  description: "AI-powered LaTeX editor with Claude",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body className="h-full overflow-hidden">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
