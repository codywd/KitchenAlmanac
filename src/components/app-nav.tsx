"use client";

import {
  Activity,
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
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { logoutAction } from "@/app/auth-actions";
import type { CurrentUser } from "@/lib/session";

type NavItem = {
  adminOnly?: boolean;
  activePrefixes?: string[];
  href: string;
  icon: LucideIcon;
  label: string;
};

type NavGroup = {
  items: NavItem[];
  label: string;
};

const navGroups: NavGroup[] = [
  {
    label: "Kitchen",
    items: [
      {
        activePrefixes: ["/weeks", "/cook"],
        href: "/calendar",
        icon: CalendarDays,
        label: "Calendar",
      },
      { href: "/planner", icon: NotebookPen, label: "Planner" },
      { href: "/recipes", icon: BookOpen, label: "Recipes" },
      { href: "/ingredients", icon: ListChecks, label: "Ingredients" },
      { href: "/meal-memory", icon: Brain, label: "Memory" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/setup", icon: ClipboardCheck, label: "Setup" },
      { href: "/household", icon: ShieldCheck, label: "Guidance" },
      { href: "/family", icon: House, label: "Family" },
      { href: "/rejected-meals", icon: ClipboardList, label: "Rejected" },
      { href: "/import", icon: Upload, label: "Import" },
      { href: "/api-keys", icon: KeyRound, label: "API keys" },
      { adminOnly: true, href: "/ops", icon: Activity, label: "Ops" },
    ],
  },
];

function isActivePath(pathname: string, item: NavItem) {
  if (pathname === item.href) {
    return true;
  }

  if (item.href !== "/calendar" && pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  return (
    item.activePrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ?? false
  );
}

function visibleNavGroups(role?: string) {
  const canManage = role === "OWNER" || role === "ADMIN";

  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || canManage),
    }))
    .filter((group) => group.items.length > 0);
}

export function DesktopNav({
  collapsed = false,
  role,
}: {
  collapsed?: boolean;
  role?: string;
}) {
  const pathname = usePathname();
  const groups = visibleNavGroups(role);

  return (
    <nav aria-label="Desktop navigation" className="mt-10">
      {groups.map((group) => (
        <div className="nav-group" data-collapsed={collapsed} key={group.label}>
          <div className="nav-group-label sidebar-expanded">{group.label}</div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item);

              return (
                <Link
                  aria-label={collapsed ? item.label : undefined}
                  className="nav-link flex min-h-11 items-center gap-3 px-3 text-sm font-extrabold transition"
                  data-active={active}
                  data-collapsed={collapsed}
                  href={item.href}
                  key={item.href}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="shrink-0" size={17} />
                  <span className="sidebar-expanded">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
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
  const groups = visibleNavGroups(role);
  const items = groups.flatMap((group) => group.items);
  const activeItem = items.find((item) => isActivePath(pathname, item));

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
            <nav className="mt-3" aria-label="Mobile navigation">
              {groups.map((group) => (
                <div className="mobile-nav-group" key={group.label}>
                  <div className="mobile-nav-group-label">{group.label}</div>
                  <div className="grid gap-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActivePath(pathname, item);

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
                  </div>
                </div>
              ))}
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
      <Link className="mobile-account-link" href="/account">
        <UserRound size={16} />
        Account
      </Link>
      <form action={logoutAction} className="mt-3">
        <button className="ka-button-secondary flex w-full gap-2">
          <LogOut size={15} />
          Sign out
        </button>
      </form>
    </div>
  );
}
