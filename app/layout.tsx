import type { Metadata } from "next";
import "./globals.css";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare, GeistPixelGrid, GeistPixelCircle, GeistPixelTriangle, GeistPixelLine } from 'geist/font/pixel';


export const metadata: Metadata = {
  title: "Paper Exchange",
  description: "Paper trading exchange",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
    lang="en"
    className={`
      ${GeistSans.variable}
      ${GeistMono.variable}
      ${GeistPixelSquare.variable}
      ${GeistPixelGrid.variable}
      ${GeistPixelCircle.variable}
      ${GeistPixelTriangle.variable}
      ${GeistPixelLine.variable}
    `}
  >
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
