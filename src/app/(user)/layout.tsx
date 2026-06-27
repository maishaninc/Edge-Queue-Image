import type { ReactNode } from "react";

export default function UserLayout({ children }: { children: ReactNode }) {
  return <div className="h-full min-h-0">{children}</div>;
}
