"use client";

import { useEffect, useState } from "react";
import { Bookmark, CheckCircle2, XCircle } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { getBookmarks, recordAttempt, toggleBookmark } from "@/lib/localProgress";

export type QuestionCardData = {
  id: string;
  paper?: "PAPER_1" | "PAPER_2";
  unit_number: number;
  unit_name?: string;
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
  source_type: "PYQ" | "AI";
  exam_year?: number | null;
  exam_session?: string | null;
};

export function QuestionCard({
  question,
  mode = "PRACTICE",
  onAnswered,
}: {
  question: QuestionCardData;
  mode?: "DAILY" | "PRACTICE";
  onAnswered?: (correct: boolean) => void;
}) {
  const [selections, setSelections] = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [bookmarked, setBookmarked] = useState(false);
  const paperOne = (question.paper ?? (question.unit_number >= 101 ? "PAPER_1" : "PAPER_2")) === "PAPER_1";
  const selected = selections[question.id] ?? "";

  useEffect(() => setBookmarked(getBookmarks().includes(question.id)), [question.id]);

  function select(option: "A" | "B" | "C" | "D") {
    if (selected) return;
    setSelections((current) => ({ ...current, [question.id]: option }));
    const correct = option === question.correct_option;
    recordAttempt({
      questionId: question.id,
      paper: paperOne ? "PAPER_1" : "PAPER_2",
      unitNumber: question.unit_number,
      selectedOption: option,
      isCorrect: correct,
      mode,
      answeredAt: new Date().toISOString(),
    });
    onAnswered?.(correct);
  }

  return (
    <article className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${paperOne ? "border-amber-300 bg-amber-100 text-amber-900" : "border-indigo-300 bg-indigo-100 text-indigo-900"}`}>
            {paperOne ? "Paper 1" : "Paper 2"}
          </span>
          <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            Unit {question.unit_number}: {question.unit_name}
          </span>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
            {question.source_type === "PYQ" ? `Official PYQ • ${question.exam_session ?? question.exam_year ?? "NTA"}` : "AI Practice"}
          </span>
        </div>
        <button
          type="button"
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark question"}
          onClick={() => setBookmarked(toggleBookmark(question.id))}
          className={`rounded-lg border p-2 ${bookmarked ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-300 text-slate-700"}`}
        >
          <Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="text-base font-semibold leading-relaxed text-slate-950">
        <MarkdownRenderer>{question.question_text}</MarkdownRenderer>
      </div>
      <div className="mt-4 space-y-2">
        {(["A", "B", "C", "D"] as const).map((key) => {
          const chosen = selected === key;
          let state = "border-slate-300 bg-slate-50 text-slate-900";
          if (selected && key === question.correct_option) state = "border-emerald-600 bg-emerald-50 text-emerald-950";
          else if (chosen) state = "border-rose-600 bg-rose-50 text-rose-950";
          return (
            <button type="button" key={key} disabled={Boolean(selected)} onClick={() => select(key)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm font-medium ${state}`}>
              <b>{key}.</b><span>{question.options[key]}</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className={`mt-4 rounded-xl border p-4 ${selected === question.correct_option ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}`}>
          <div className="mb-2 flex items-center gap-2 font-bold">
            {selected === question.correct_option ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            Correct answer: {question.correct_option}
          </div>
          <div className="text-sm leading-relaxed"><MarkdownRenderer>{question.explanation}</MarkdownRenderer></div>
        </div>
      )}
    </article>
  );
}
