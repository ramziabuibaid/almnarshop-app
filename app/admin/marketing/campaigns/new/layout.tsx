import { Metadata } from "next";

export const metadata: Metadata = {
  title: "إضافة عرض ترويجي جديد - New Campaign",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
