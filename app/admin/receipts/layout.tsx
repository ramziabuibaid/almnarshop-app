import { Metadata } from "next";

export const metadata: Metadata = {
  title: "سندات القبض - Receipts",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
