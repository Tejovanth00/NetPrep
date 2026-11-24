"use client";

import { useEffect, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { QuestionCard, type QuestionCardData } from "@/components/QuestionCard";
import { getAttempts, getBookmarks } from "@/lib/localProgress";

export default function BookmarksPage() {
  const [tab, setTab] = useState<"saved" | "mistakes">("saved");
  const [questions, setQuestions] = useState<QuestionCardData[]>([]);

  useEffect(() => {
    const sync = () => {
      const mistakeIds = getAttempts().filter((attempt) => !attempt.isCorrect).map((attempt) => attempt.questionId);
      const ids = tab === "saved" ? getBookmarks() : Array.from(new Set(mistakeIds));
      if (!ids.length) {
        setQuestions([]);
        return;
      }
      fetch(`/api/questions?ids=${encodeURIComponent(ids.join(","))}`)
        .then((response) => response.json())
        .then((data) => setQuestions(data.questions ?? []));
    };
    sync();
    window.addEventListener("netprep-progress", sync);
    return () => window.removeEventListener("netprep-progress", sync);
  }, [tab]);

  return (
    <main className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 py-7">
        <h1 className="text-4xl font-bold text-slate-950">Revision Deck</h1>
        <div className="my-5 flex rounded-xl border border-slate-300 bg-white p-1">
          <button type="button" onClick={() => setTab("saved")} className={`flex-1 rounded-lg py-3 font-bold ${tab === "saved" ? "bg-indigo-700 text-white" : "text-slate-700"}`}>Bookmarks</button>
          <button type="button" onClick={() => setTab("mistakes")} className={`flex-1 rounded-lg py-3 font-bold ${tab === "mistakes" ? "bg-indigo-700 text-white" : "text-slate-700"}`}>Recent Mistakes</button>
        </div>
        {questions.length === 0 && <div className="rounded-2xl border border-slate-300 bg-white p-8 text-center font-medium text-slate-700">No questions in this deck yet.</div>}
        <div className="space-y-5">
          {questions.map((question) => <QuestionCard key={question.id} question={question} />)}
        </div>
      </div>
    </main>
  );
}
