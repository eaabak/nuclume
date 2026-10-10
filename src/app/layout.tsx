import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NUCLUME — From Atom to City",
  description:
    "An interactive journey from uranium-235 and nuclear fission through a pressurized water reactor to an illuminated city.",
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
