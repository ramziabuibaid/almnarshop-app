import { Metadata } from "next";

export const metadata: Metadata = {
  title: "فواتير مبيعات المحل",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
