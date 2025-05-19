"use client";

import "./globals.css"; // Import your Tailwind CSS or global styles
import Link from "next/link";

//TODO: Add logo to header


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-black min-h-screen bg-white text-black font-serif">
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex no-wrap items-center justify-between">
            <h1 className="text-2xl font-bold mr-4">PRECISION</h1>
            <h1 className="text-lg font-bold">WATCH & DIAMOND</h1>
          </div>
          <nav className="space-x-10 mr-20">
            <Link href="/" className="hover:underline">Home</Link>
            <Link href="/gallery" className="hover:underline">Gallery</Link>
            <Link href="/custom-form" className="hover:underline">Custom Request</Link>
            <Link href="/about" className="hover:underline">About</Link>
          </nav>
        </header>

        <main>{children}</main>

        <footer className="mt-12 border-t px-6 py-4 text-center text-sm text-gray-600">
          &copy; {new Date().getFullYear()} Precision Watch & Diamond. All rights reserved.
        </footer>
      </body>
    </html>
  );
}