import {
  LogOut,
  Utensils,
} from "lucide-react";
import Link from "next/link";

import { logoutAction } from "@/app/auth-actions";
import { DesktopNav, MobileNav } from "@/components/app-nav";
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
    <div className="ka-app">
      <aside className="nav-rail fixed inset-y-0 left-0 hidden w-72 px-6 py-7 lg:block">
        <Link className="group block" href="/calendar">
          <span className="grid size-12 place-items-center bg-[var(--tomato)] text-[var(--flour)] transition group-hover:bg-[var(--tomato-dark)]">
            <Utensils size={21} />
          </span>
          <span className="recipe-display mt-5 block max-w-56 break-words text-3xl font-semibold leading-none text-[var(--ink)]">
            KitchenAlmanac
          </span>
          <span className="mt-3 block text-sm font-bold leading-6 text-[var(--muted-ink)]">
            Private household meals, shopping, and recipes.
          </span>
        </Link>
        <DesktopNav />
        <div className="absolute inset-x-6 bottom-6 border-t border-[var(--line)] pt-5">
          <div className="text-sm font-extrabold text-[var(--ink)]">
            {user.name ?? user.email}
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-[var(--muted-ink)]">
            {user.email}
          </div>
          {family ? (
            <div className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
              {family.name} / {role?.toLowerCase()}
            </div>
          ) : null}
          <form action={logoutAction} className="mt-3">
            <button className="ka-button-secondary flex w-full gap-2">
              <LogOut size={15} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[rgba(255,247,232,0.92)] px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <Link className="flex items-center gap-3" href="/calendar">
              <span className="grid size-10 place-items-center bg-[var(--tomato)] text-[var(--flour)]">
                <Utensils size={19} />
              </span>
              <span className="recipe-display text-xl font-semibold text-[var(--ink)] sm:text-2xl">
                KitchenAlmanac
              </span>
            </Link>
            <form action={logoutAction}>
              <button className="ka-icon-button">
                <LogOut size={17} />
              </button>
            </form>
          </div>
          <MobileNav />
        </header>
        <main className="ka-main w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
