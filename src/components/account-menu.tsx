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

  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent p-0 hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Account menu"
        title={user?.name ? `${user.name} — Account menu` : "Account menu"}
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user?.name ?? "Account"} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-xs dark:bg-white/10">
            {initials || ""}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded border bg-white p-1 text-sm shadow-lg dark:border-white/10 dark:bg-zinc-900"
        >
          <Link
            role="menuitem"
            href={`/settings?returnTo=${encodeURIComponent(current || "/")}`}
            onClick={() => setOpen(false)}
            className="block w-full rounded px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
            title="Account settings"
          >
            Account Settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/api/auth/signin" });
            }}
            className="block w-full rounded px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
