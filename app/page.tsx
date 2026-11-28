"use client";

import { useEffect, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { ExamCountdown } from "@/components/ExamCountdown";
import { QuestionCard, type QuestionCardData } from "@/components/QuestionCard";
import { completeDailyQuiz, getAttempts, getCurrentStreak } from "@/lib/localProgress";

export default function Home() {
  const [questions, setQuestions] = useState<QuestionCardData[]>([]);
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/today", { cache: "no-store" });
        const body = await response.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new Error(`Quiz service returned an invalid response (HTTP ${response.status}). Please try again shortly.`);
        }
        if (typeof parsed !== "object" || parsed === null) {
          throw new Error(`Quiz service returned an invalid response (HTTP ${response.status}). Please try again shortly.`);
        }
        const data = parsed as { error?: string; questions?: QuestionCardData[]; date?: string };
        if (!response.ok) {
          throw new Error(data.error ?? `Could not load today's quiz (HTTP ${response.status}).`);
        }
        if (!Array.isArray(data.questions) || data.questions.length !== 10) {
          throw new Error("Quiz service did not return a complete 10-question quiz. Please try again.");
        }

        if (cancelled) return;
        const dailyQuestions = data.questions;
        const dailyAttempts = getAttempts().filter((attempt) => attempt.mode === "DAILY");
        const savedAnswers = Object.fromEntries(
          dailyAttempts
            .filter((attempt) => dailyQuestions.some((question) => question.id === attempt.questionId))
            .map((attempt) => [attempt.questionId, attempt.isCorrect]),
        );
        setQuestions(dailyQuestions);
        setAnswered(savedAnswers);
        const firstUnanswered = dailyQuestions.findIndex((question) => !(question.id in savedAnswers));
        setCurrent(firstUnanswered < 0 ? 0 : firstUnanswered);
        setDate(data.date ?? "");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load today's quiz.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadToday();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const score = Object.values(answered).filter(Boolean).length;
  const complete = questions.length > 0 && Object.keys(answered).length === questions.length;
  function answer(questionId: string, correct: boolean) {
    setAnswered((currentAnswers) => ({ ...currentAnswers, [questionId]: correct }));
  }

  useEffect(() => {
    if (complete && date) completeDailyQuiz(date, score, questions.length);
  }, [complete, date, score, questions.length]);

  async function share() {
    const today = new Intl.DateTimeFormat("en-GB", { timeZone:"Asia/Kolkata", day:"2-digit", month:"short", year:"numeric" }).format(new Date());
    const streak = getCurrentStreak(date);
    const summary = `NetPrep Daily 10 (${today}): ${score}/${questions.length} 🎯 | Streak: ${streak} days 🔥`;
    await navigator.clipboard?.writeText(summary);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <NavBar />
      <div className="mx-auto max-w-3xl px-4 py-7">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">UGC NET · Subject 87</p>
          <h1 className="mt-1 text-4xl font-bold text-slate-950">NetPrep Daily 10</h1>
          {date && <p className="mt-1 font-medium text-slate-700">{date}</p>}
        </header>
        <ExamCountdown />
        {error && (
          <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              disabled={loading}
              className="mt-3 rounded-lg bg-rose-800 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              {loading ? "Retrying..." : "Retry"}
            </button>
          </div>
        )}
        {loading && questions.length === 0 && <div className="mt-5 rounded-xl border border-slate-300 bg-white p-8 text-center text-slate-700">Preparing today&apos;s questions...</div>}
        {questions.length > 0 && !complete && (
          <>
            <div className="my-5 h-2 overflow-hidden rounded-full bg-slate-300">
              <div className="h-full bg-indigo-600 transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {questions.map((question, index) => (
                <button key={question.id} type="button" onClick={() => setCurrent(index)} className={`h-9 w-9 rounded-full border text-sm font-bold ${answered[question.id] === true ? "border-emerald-600 bg-emerald-100 text-emerald-900" : answered[question.id] === false ? "border-rose-600 bg-rose-100 text-rose-900" : "border-slate-300 bg-white text-slate-700"}`}>{index + 1}</button>
              ))}
            </div>
            <QuestionCard question={questions[current]} mode="DAILY" onAnswered={(correct) => answer(questions[current].id, correct)} />
            <div className="mt-4 flex justify-between">
              <button type="button" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 disabled:opacity-40">Previous</button>
              <button type="button" disabled={current === questions.length - 1} onClick={() => setCurrent((value) => value + 1)} className="rounded-xl bg-indigo-700 px-4 py-3 font-bold text-white disabled:opacity-40">Next</button>
            </div>
          </>
        )}
        {complete && (
          <section className="mt-5 rounded-2xl border border-indigo-300 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-700">Daily 10 Scorecard</p>
            <p className="mt-2 text-5xl font-black text-slate-950">{score}/{questions.length}</p>
            <p className="mt-2 font-semibold text-slate-700">{Math.round((score / questions.length) * 100)}% accuracy</p>
            <button type="button" onClick={share} className="mt-5 rounded-xl bg-indigo-700 px-5 py-3 font-bold text-white">Share Score</button>
          </section>
        )}
      </div>
    </main>
  );
}
