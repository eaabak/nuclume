import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NUCLUME — The First Atom",
  description:
    "From a single atom to an entire city. Explore the 92 protons and 143 neutrons at the heart of uranium-235 in an interactive 3D experience.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
