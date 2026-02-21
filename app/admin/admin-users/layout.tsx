import { Metadata } from "next";

export const metadata: Metadata = {
  title: "مستخدمو الإدارة - Admin Users",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
