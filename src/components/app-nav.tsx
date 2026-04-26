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
  NotebookPen,
  UserRound,
  ShieldCheck,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-3 grid grid-cols-4 gap-x-2 gap-y-1 sm:grid-cols-8">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            className="mobile-nav-link grid min-h-14 place-items-center px-1 pb-2 text-xs font-extrabold transition"
            data-active={active}
            href={item.href}
            key={item.href}
          >
            <Icon size={16} />
            <span className="mt-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
