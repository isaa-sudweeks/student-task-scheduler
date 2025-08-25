"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function AccountMenu() {
  const { data } = useSession();
  const user = data?.user;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = React.useMemo(() => {
    const q = searchParams?.toString();
    return q && q.length > 0 ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);
  const initials = React.useMemo(() => {
    if (!user?.name) return "";
    const parts = user.name.split(" ").filter(Boolean);
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
  }, [user?.name]);

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/settings?returnTo=${encodeURIComponent(current || "/")}`}
        className="inline-flex items-center gap-2 rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        title="Account settings"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user?.name ?? "Account"} className="h-6 w-6 rounded-full" />
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-xs dark:bg-white/10">
            {initials || ""}
          </span>
        )}
        <span className="hidden sm:inline">Settings</span>
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
        className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        title="Sign out"
      >
        Sign out
      </button>
    </div>
  );
}
