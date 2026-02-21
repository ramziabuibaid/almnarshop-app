import { Metadata } from "next";

export const metadata: Metadata = {
  title: "المهام والمتابعات",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
