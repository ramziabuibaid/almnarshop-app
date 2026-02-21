import { Metadata } from "next";

export const metadata: Metadata = {
  title: "نقطة البيع - POS",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
