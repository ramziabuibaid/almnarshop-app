import { Metadata } from "next";

export const metadata: Metadata = {
  title: "صندوق المحل",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
