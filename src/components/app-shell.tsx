import { AppChrome } from "@/components/app-chrome";
import type { CurrentUser } from "@/lib/session";

export function AppShell({
  children,
  family,
  role,
  user,
}: {
  children: React.ReactNode;
  family?: {
    name: string;
  };
  role?: string;
  user: CurrentUser;
}) {
  return (
    <AppChrome family={family} role={role} user={user}>
      {children}
    </AppChrome>
  );
}
