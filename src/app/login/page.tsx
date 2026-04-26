import { redirect } from "next/navigation";

import { loginAction } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);

  if (user) {
    redirect("/calendar");
  }

  return (
    <main className="login-hero grid min-h-screen items-center px-5 py-10 sm:px-8">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#f5c85b]">
            Private household app
          </p>
          <h1 className="recipe-display mt-4 max-w-3xl text-6xl font-semibold leading-[0.9] text-[var(--flour)] sm:text-7xl lg:text-8xl">
            KitchenAlmanac
          </h1>
          <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-[#fff3d9]">
            A quieter weekly table for dinner plans, grocery memory, and the guidance
            your household actually cooks by.
          </p>
        </div>
        <div className="login-form w-full p-6">
          <h2 className="recipe-display text-3xl font-semibold">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
            Protected calendar, meal history, API keys, and planning guidance.
          </p>
        {params.error === "invalid" ? (
          <div className="ka-error mt-5 text-sm">
            Email or password did not match.
          </div>
        ) : null}
        <form action={loginAction} className="mt-6 space-y-4">
          <input
            name="returnTo"
            type="hidden"
            value={params.returnTo ?? "/calendar"}
          />
          <label className="block">
            <span className="ka-label">Email</span>
            <input
              autoComplete="email"
              className="ka-field"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="block">
            <span className="ka-label">Password</span>
            <input
              autoComplete="current-password"
              className="ka-field"
              name="password"
              required
              type="password"
            />
          </label>
          <button className="ka-button w-full">
            Sign in
          </button>
        </form>
        </div>
      </div>
    </main>
  );
}
