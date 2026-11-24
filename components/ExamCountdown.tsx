"use client";

import { useEffect, useState } from "react";

const TARGET = new Date("2026-12-14T09:00:00+05:30").getTime();

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

export function ExamCountdown() {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    function update() {
      const distance = Math.max(0, TARGET - Date.now());
      setRemaining({
        days: Math.floor(distance / 86400000),
        hours: Math.floor((distance % 86400000) / 3600000),
        minutes: Math.floor((distance % 3600000) / 60000),
        seconds: Math.floor((distance % 60000) / 1000),
      });
    }
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const days = remaining?.days ?? 0;
  const phase =
    remaining === null
      ? "Loading exam countdown"
      : days > 30
        ? "Foundation & Broad Coverage Phase"
        : days >= 8
          ? "High-Yield Revision Phase (Prioritizing Core Units)"
          : "Final Sprint: Most Repeated Concepts & Full Recall";

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#bfd8d3] bg-[#17324d] text-white shadow-[0_10px_30px_rgba(23,50,77,0.12)]" aria-live="polite">
      <div className="px-5 pb-4 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a8d8cf]">UGC NET CS Shift 1</p>
            <h2 className="mt-1 text-lg font-black">December 14, 2026 · 9:00 AM IST</h2>
          </div>
          <span className="rounded-full border border-[#dcb96a] bg-[#f4dfad] px-3 py-1.5 text-xs font-extrabold text-[#5f4512]">{phase}</span>
        </div>
        {remaining ? (
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Days", remaining.days],
              ["Hours", remaining.hours],
              ["Minutes", remaining.minutes],
              ["Seconds", remaining.seconds],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-[#75a99f] bg-[#225268] px-2 py-3 text-center">
                <div className="text-2xl font-black tabular-nums sm:text-3xl">{String(value).padStart(2, "0")}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#d8ebe7]">{label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-16 animate-pulse rounded-xl bg-indigo-900" />
        )}
      </div>
    </section>
  );
}
