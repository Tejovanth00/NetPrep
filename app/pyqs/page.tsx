"use client";

import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { QuestionCard, type QuestionCardData } from "@/components/QuestionCard";
import { getAttempts, getBookmarks } from "@/lib/localProgress";
import { SYLLABUS_UNITS } from "@/lib/syllabus";

export default function PyqsPage() {
  const [questions, setQuestions] = useState<QuestionCardData[]>([]);
  const [paper, setPaper] = useState("");
  const [unit, setUnit] = useState("");
  const [source, setSource] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfs, setPdfs] = useState<string[]>([]);

  useEffect(() => {
    setUnit(new URLSearchParams(window.location.search).get("unit") ?? "");
    fetch("/api/pdfs")
      .then((response) => response.json())
      .then((data) => setPdfs(data.pdfs ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (paper) params.set("paper", paper);
    if (unit) params.set("unit", unit);
    if (source) params.set("source", source);
    if (year) params.set("year", year);
    if (search) params.set("search", search);
    fetch(`/api/questions?${params}`)
      .then((response) => response.json())
      .then((data) => {
        setQuestions(data.questions ?? []);
        setYears(data.years ?? []);
      })
      .finally(() => setLoading(false));
  }, [paper, unit, source, year, search]);

  const filtered = useMemo(() => {
    const bookmarks = getBookmarks();
    const attempts = getAttempts();
    if (status === "All") return questions;
    if (status === "Bookmarked") return questions.filter((question) => bookmarks.includes(question.id));
    if (status === "Unattempted") return questions.filter((question) => !attempts.some((attempt) => attempt.questionId === question.id));
    return questions.filter((question) => attempts.some((attempt) => attempt.questionId === question.id && !attempt.isCorrect));
  }, [questions, status]);

  async function practice10() {
    const params = new URLSearchParams({ random: "true", limit: "10" });
    if (paper) params.set("paper", paper);
    if (unit) params.set("unit", unit);
    if (source) params.set("source", source);
    if (year) params.set("year", year);
    if (search) params.set("search", search);
    const response = await fetch(`/api/questions?${params}`);
    const data = await response.json();
    setQuestions(data.questions ?? []);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-7">
        <h1 className="text-4xl font-bold text-slate-950">PYQ Bank & Practice</h1>
        {pdfs.length > 0 && (
          <section className="my-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <h2 className="font-bold text-indigo-950">Official PDF Papers</h2>
            <p className="mt-1 text-sm text-indigo-900">Open and reference the original NTA papers directly while extraction proceeds.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {pdfs.map((pdf) => (
                <a
                  key={pdf}
                  href={`/api/pdf/${encodeURIComponent(pdf)}#view=FitH`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-indigo-300 bg-white px-4 py-3 font-semibold text-indigo-900 hover:bg-indigo-100"
                >
                  {pdf}
                </a>
              ))}
            </div>
          </section>
        )}
        <div className="my-5 grid gap-3 md:grid-cols-3">
          <select value={paper} onChange={(event) => setPaper(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium text-slate-900">
            <option value="">All Papers</option><option value="PAPER_1">Paper 1</option><option value="PAPER_2">Paper 2</option>
          </select>
          <select value={unit} onChange={(event) => setUnit(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium text-slate-900">
            <option value="">All Units</option>
            {(["PAPER_1", "PAPER_2"] as const).map((paperName) => (
              <optgroup key={paperName} label={paperName === "PAPER_1" ? "Paper 1" : "Paper 2"}>
                {SYLLABUS_UNITS.filter((item) => item.paper === paperName).map((item) => <option key={item.unitNumber} value={item.unitNumber}>{item.unitNumber} · {item.unitName}</option>)}
              </optgroup>
            ))}
          </select>
          <select value={source} onChange={(event) => setSource(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium text-slate-900">
            <option value="">All Sources</option><option value="PYQ">Official PYQ</option><option value="AI">AI Generated</option>
          </select>
          <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium text-slate-900">
            <option value="">All Years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium text-slate-900">
            {["All", "Unattempted", "Incorrect", "Bookmarked"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions..." className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-medium text-slate-900" />
        </div>
        <button type="button" onClick={practice10} className="mb-5 rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white">Start 10-Question Practice Set</button>
        {loading && <p className="rounded-xl border border-slate-300 bg-white p-6 text-slate-700">Loading questions...</p>}
        {!loading && filtered.length === 0 && <p className="rounded-xl border border-slate-300 bg-white p-8 text-center text-slate-700">No questions match these filters.</p>}
        <div className="space-y-5">
          {filtered.map((question) => <QuestionCard key={question.id} question={question} />)}
        </div>
      </div>
    </main>
  );
}
