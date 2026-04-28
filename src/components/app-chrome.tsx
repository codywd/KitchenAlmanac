"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen, Utensils } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { logoutAction } from "@/app/auth-actions";
import { DesktopNav, MobileNav } from "@/components/app-nav";
import type { CurrentUser } from "@/lib/session";

const sidebarStorageKey = "kitchenalmanac.sidebarCollapsed";
const sidebarStorageEvent = "kitchenalmanac:sidebarCollapsed";

function getSidebarSnapshot() {
  return window.localStorage.getItem(sidebarStorageKey) === "true";
}

function getServerSidebarSnapshot() {
  return false;
}

function subscribeToSidebarPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(sidebarStorageEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(sidebarStorageEvent, onStoreChange);
  };
}

export function AppChrome({
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
  const collapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarSnapshot,
    getServerSidebarSnapshot,
  );

  function toggleSidebar() {
    window.localStorage.setItem(sidebarStorageKey, String(!collapsed));
    window.dispatchEvent(new Event(sidebarStorageEvent));
  }

  return (
    <div className="ka-app">
      <aside
        className="nav-rail fixed inset-y-0 left-0 hidden px-6 py-7 lg:block"
        data-collapsed={collapsed}
      >
        <div className="sidebar-header flex items-start justify-between gap-3">
          <Link
            aria-label="KitchenAlmanac calendar"
            className="group block min-w-0"
            href="/calendar"
          >
            <span className="grid size-12 place-items-center bg-[var(--tomato)] text-[var(--flour)] transition group-hover:bg-[var(--tomato-dark)]">
              <Utensils size={21} />
            </span>
            <span className="sidebar-expanded recipe-display mt-5 block max-w-56 break-words text-3xl font-semibold leading-none text-[var(--ink)]">
              KitchenAlmanac
            </span>
            <span className="sidebar-expanded mt-3 block text-sm font-bold leading-6 text-[var(--muted-ink)]">
              Private household meals, shopping, and recipes.
            </span>
          </Link>
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ka-icon-button sidebar-toggle shrink-0"
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <DesktopNav collapsed={collapsed} role={role} />
        <div className="desktop-user-menu absolute inset-x-6 bottom-6 border-t border-[var(--line)] pt-5">
          <div
            className="text-sm font-extrabold text-[var(--ink)]"
            title={user.name ?? user.email}
          >
            {collapsed
              ? (user.name ?? user.email).slice(0, 1).toUpperCase()
              : user.name ?? user.email}
          </div>
          <div className="sidebar-expanded mt-1 truncate text-xs font-semibold text-[var(--muted-ink)]">
            {user.email}
          </div>
          {family ? (
            <div className="sidebar-expanded mt-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
              {family.name} / {role?.toLowerCase()}
            </div>
          ) : null}
          <form action={logoutAction} className="mt-3">
            <button
              className="ka-button-secondary flex w-full gap-2"
              title={collapsed ? "Sign out" : undefined}
            >
              <LogOut size={15} />
              <span className="sidebar-expanded">Sign out</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="ka-shell-content" data-sidebar-collapsed={collapsed}>
        <header className="mobile-topbar sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(255,247,232,0.94)] px-3 py-2 backdrop-blur lg:hidden">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Link className="flex min-w-0 items-center gap-3" href="/calendar">
              <span className="grid size-9 shrink-0 place-items-center bg-[var(--tomato)] text-[var(--flour)]">
                <Utensils size={19} />
              </span>
              <span className="recipe-display truncate text-xl font-semibold text-[var(--ink)]">
                KitchenAlmanac
              </span>
            </Link>
            <MobileNav family={family} role={role} user={user} />
          </div>
        </header>
        <main className="ka-main w-full min-w-0">{children}</main>
      </div>
    </div>
  );
}
