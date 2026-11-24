"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Bookmark, CalendarDays, Landmark, History } from "lucide-react";
import { getCurrentStreak } from "@/lib/localProgress";

export function NavBar({ daysRemaining }: { daysRemaining?: number }) {
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    const sync = () => {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
      setStreak(getCurrentStreak(today));
    };
    sync();
    window.addEventListener("netprep-progress", sync);
    return () => window.removeEventListener("netprep-progress", sync);
  }, []);
  return (
    <nav className="sticky top-0 z-20 border-b border-[#d9ddd5] bg-[#fbfcf8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-[#17324d]">NET Daily 10</Link>
        <div className="hidden items-center gap-5 text-sm font-bold sm:flex">
          <Link href="/" className="flex items-center gap-1.5"><CalendarDays size={17} />Daily 10</Link>
          <Link href="/archive" className="flex items-center gap-1.5"><History size={17} />Archive</Link>
          <Link href="/pyqs" className="flex items-center gap-1.5"><Landmark size={17} />PYQ Bank</Link>
          <Link href="/analytics" className="flex items-center gap-1.5"><BarChart3 size={17} />Analytics</Link>
          <Link href="/bookmarks" className="flex items-center gap-1.5"><Bookmark size={17} />Bookmarks</Link>
        </div>
        <div className="flex items-center gap-2">
          {daysRemaining !== undefined && (
            <span className="hidden rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 sm:inline">{daysRemaining} days</span>
          )}
          <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-900">🔥 {streak}d</span>
        </div>
      </div>
      <div className="flex justify-around border-t border-slate-100 px-2 py-2 text-xs font-bold sm:hidden">
        <Link href="/">Daily</Link>
        <Link href="/archive">Archive</Link>
        <Link href="/pyqs">PYQs</Link>
        <Link href="/analytics">Stats</Link>
        <Link href="/bookmarks">Saved</Link>
      </div>
    </nav>
  );
}
