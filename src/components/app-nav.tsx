"use client";

import {
  Brain,
  BookOpen,
  House,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  KeyRound,
  ListChecks,
  LogOut,
  Menu,
  NotebookPen,
  UserRound,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { logoutAction } from "@/app/auth-actions";
import type { CurrentUser } from "@/lib/session";

const navItems = [
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/setup", icon: ClipboardCheck, label: "Setup" },
  { href: "/planner", icon: NotebookPen, label: "Planner" },
  { href: "/recipes", icon: BookOpen, label: "Recipes" },
  { href: "/meal-memory", icon: Brain, label: "Memory" },
  { href: "/import", icon: Upload, label: "Import" },
  { href: "/ingredients", icon: ListChecks, label: "Ingredients" },
  { href: "/rejected-meals", icon: ClipboardList, label: "Rejected" },
  { href: "/api-keys", icon: KeyRound, label: "API keys" },
  { href: "/household", icon: ShieldCheck, label: "Guidance" },
  { href: "/family", icon: House, label: "Family" },
  { href: "/account", icon: UserRound, label: "Account" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/calendar") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-10 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            className="nav-link flex min-h-11 items-center gap-3 px-3 text-sm font-extrabold transition"
            data-active={active}
            href={item.href}
            key={item.href}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({
  family,
  role,
  user,
}: {
  family?: {
    name: string;
  };
  role?: string;
  user: CurrentUser;
}) {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const activeItem = navItems.find((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="mobile-menu">
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="ka-icon-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {open ? (
        <>
          <button
            aria-label="Close navigation menu"
            className="mobile-menu-scrim"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div className="mobile-menu-panel" id={menuId}>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <p className="ka-kicker">Menu</p>
                <p className="mt-1 text-sm font-black text-[var(--ink)]">
                  {activeItem?.label ?? "KitchenAlmanac"}
                </p>
              </div>
            </div>
            <nav className="mt-3 grid gap-1" aria-label="Mobile navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    className="mobile-menu-link flex min-h-11 items-center gap-3 px-3 text-sm font-extrabold transition"
                    data-active={active}
                    href={item.href}
                    key={item.href}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <MobileUserMenu family={family} role={role} user={user} />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function MobileUserMenu({
  family,
  role,
  user,
}: {
  family?: {
    name: string;
  };
  role?: string;
  user: CurrentUser;
}) {
  return (
    <div className="mobile-menu-user border-t border-[var(--line)] pt-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-[var(--ink)]">
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
      </div>
      <form action={logoutAction} className="mt-3">
        <button className="ka-button-secondary flex w-full gap-2">
          <LogOut size={15} />
          Sign out
        </button>
      </form>
    </div>
  );
}
