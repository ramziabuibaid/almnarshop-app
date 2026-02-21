import { Metadata } from "next";

export const metadata: Metadata = {
  title: "العروض السعرية",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
