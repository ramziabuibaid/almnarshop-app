import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const dateTime = `${y}-${m}-${d}_${h}-${min}-${s}`;
  return { title: dateTime };
}

export default function LabelsPrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
