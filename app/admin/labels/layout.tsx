import { Metadata } from "next";

export const metadata: Metadata = {
  title: "طباعة الملصقات",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
