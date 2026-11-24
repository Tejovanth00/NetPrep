"use client";

import { useEffect, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

type ArchivedQuestion = {
  id: string;
  paper: "PAPER_1" | "PAPER_2";
  unit_number: number;
  unit_name: string;
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
  source_type: "PYQ" | "AI";
  exam_year?: number | null;
  exam_session?: string | null;
};

export default function ArchivePage() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [questions, setQuestions] = useState<ArchivedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/archive")
      .then((response) => response.json())
      .then((data) => {
        const items = (data.dates ?? []).map((item: { quiz_date: string }) => item.quiz_date);
        setDates(items);
        if (items[0]) setSelected(items[0]);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/archive?date=${selected}`)
      .then((response) => response.json())
      .then((data) => setQuestions(data.questions ?? []))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <main className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 py-7">
        <h1 className="mb-5 text-4xl font-bold text-slate-950">Previous Quiz Archive</h1>
        {dates.length > 0 ? (
          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-bold text-slate-700">Choose quiz date</span>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            >
              {dates.map((date) => <option key={date} value={date}>{date}</option>)}
            </select>
          </label>
        ) : (
          <p className="mb-6 rounded-xl border border-slate-300 bg-white p-5 font-medium text-slate-700">No previous quizzes have been published yet.</p>
        )}
        {loading && <p className="rounded-xl border border-slate-300 bg-white p-6 text-slate-700">Loading quiz...</p>}
        {!loading && selected && questions.length === 0 && (
          <p className="rounded-xl border border-slate-300 bg-white p-6 text-slate-700">No questions were saved for {selected}.</p>
        )}
        {questions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const allOpen = questions.every((question) => revealed[question.id]);
              setRevealed(Object.fromEntries(questions.map((question) => [question.id, !allOpen])));
            }}
            className="mb-5 w-full rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 font-bold text-indigo-950"
          >
            {questions.every((question) => revealed[question.id]) ? "Hide All Answers" : "Reveal All Answers"}
          </button>
        )}
        <div className="space-y-5">
          {questions.map((question, index) => (
            <article key={question.id} className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${question.paper === "PAPER_1" ? "border-amber-300 bg-amber-100 text-amber-900" : "border-indigo-300 bg-indigo-100 text-indigo-900"}`}>
                  {question.paper === "PAPER_1" ? "Paper 1" : "Paper 2"}
                </span>
                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Unit {question.unit_number}: {question.unit_name}
                </span>
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
                  {question.source_type === "PYQ" ? `Official PYQ${question.exam_session ? ` • ${question.exam_session}` : ""}` : "AI Practice"}
                </span>
              </div>
              <h2 className="font-semibold leading-relaxed text-slate-950">Q{index + 1}. <MarkdownRenderer>{question.question_text}</MarkdownRenderer></h2>
              <div className="mt-4 space-y-2">
                {(["A", "B", "C", "D"] as const).map((key) => (
                  <div key={key} className={`rounded-xl border px-3 py-2 text-sm font-medium ${revealed[question.id] && key === question.correct_option ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-300 bg-slate-50 text-slate-900"}`}>
                    <b className="mr-2">{key}.</b>{question.options[key]}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setRevealed((current) => ({ ...current, [question.id]: !current[question.id] }))}
                className="mt-4 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800"
              >
                {revealed[question.id] ? "Hide Answer" : "Show Answer"}
              </button>
              {revealed[question.id] && (
                <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <p className="font-bold">Correct answer: {question.correct_option}</p>
                  <div className="mt-2 leading-relaxed"><MarkdownRenderer>{question.explanation}</MarkdownRenderer></div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
