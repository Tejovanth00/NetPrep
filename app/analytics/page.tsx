"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { exportProgressJSON, getAttempts, getUnitStats, resetProgress } from "@/lib/localProgress";

export default function AnalyticsPage() {
  const [stats, setStats] = useState(getUnitStats());
  const [attempts, setAttempts] = useState(getAttempts());

  useEffect(() => {
    const sync = () => {
      setStats(getUnitStats());
      setAttempts(getAttempts());
    };
    window.addEventListener("netprep-progress", sync);
    return () => window.removeEventListener("netprep-progress", sync);
  }, []);

  const overall = attempts.length
    ? Math.round((attempts.filter((attempt) => attempt.isCorrect).length / attempts.length) * 100)
    : 0;
  const weakest = [...stats].filter((unit) => unit.attempted > 0).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

  function backup() {
    const blob = new Blob([exportProgressJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "netprep-progress.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-7">
        <h1 className="text-4xl font-bold text-slate-950">Unit Analytics</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-300 bg-white p-5"><p className="text-sm font-bold text-slate-700">Overall accuracy</p><p className="text-3xl font-black text-slate-950">{overall}%</p></div>
          <div className="rounded-2xl border border-slate-300 bg-white p-5"><p className="text-sm font-bold text-slate-700">Questions solved</p><p className="text-3xl font-black text-slate-950">{attempts.length}</p></div>
          <div className="rounded-2xl border border-slate-300 bg-white p-5"><p className="text-sm font-bold text-slate-700">Units practiced</p><p className="text-3xl font-black text-slate-950">{stats.filter((unit) => unit.attempted).length}/20</p></div>
        </div>
        {weakest.length > 0 && (
          <section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-bold text-amber-950">Top 3 weakest units</h2>
            <div className="mt-3 space-y-2">
              {weakest.map((unit) => (
                <div key={unit.unitNumber} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3">
                  <span className="font-semibold text-slate-900">{unit.unitName} · {unit.accuracy}%</span>
                  <Link className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-sm font-bold text-white" href={`/pyqs?unit=${unit.unitNumber}`}>Drill unit →</Link>
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-300 bg-white">
          {stats.map((unit) => (
            <Link key={unit.unitNumber} href={`/pyqs?unit=${unit.unitNumber}`} className="grid grid-cols-[70px_1fr_70px] items-center gap-3 border-b border-slate-200 px-4 py-3 last:border-0">
              <span className="text-sm font-bold text-slate-700">U{unit.unitNumber}</span>
              <div>
                <p className="font-semibold text-slate-900">{unit.unitName}</p>
                <div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${unit.accuracy}%` }} /></div>
              </div>
              <span className="text-right text-sm font-bold text-slate-700">{unit.correct}/{unit.attempted} · {unit.accuracy}%</span>
            </Link>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={backup} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800">Backup JSON</button>
          <button type="button" onClick={() => { resetProgress(); setStats(getUnitStats()); setAttempts([]); }} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 font-bold text-rose-900">Reset Progress</button>
        </div>
      </div>
    </main>
  );
}
