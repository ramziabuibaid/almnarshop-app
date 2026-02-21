import { Metadata } from "next";

export const metadata: Metadata = {
  title: "سندات الدفع - Payments",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
