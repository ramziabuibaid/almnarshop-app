import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo, Nunito, Montserrat, Raleway } from "next/font/google";
import "./globals.css";
import { ShopProvider } from "@/context/ShopContext";
import { InvoicesProvider } from "@/context/InvoicesContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["400", "700", "900"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "My Shop - Retail Web App",
  description: "Modern mobile-first retail web app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} ${nunito.variable} ${montserrat.variable} ${raleway.variable} antialiased`}
      >
        <AdminAuthProvider>
          <ShopProvider>
            <InvoicesProvider>
              {children}
            </InvoicesProvider>
          </ShopProvider>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
