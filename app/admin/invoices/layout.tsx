import { Metadata } from "next";

export const metadata: Metadata = {
  title: "الفواتير النقدية",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
