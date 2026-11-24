"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";

export type QuizQuestion = {
  id?: string;
  question_text: string;
  options: { A: string; B: string; C: string; D: string } | { [key: string]: string };
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
  source_type?: "PYQ" | "AI";
  exam_year?: number | null;
  unit_number?: number;
  syllabus_units?: {
    unit_number: number;
    unit_name: string;
    paper?: "PAPER_1" | "PAPER_2";
  } | null;
};

function optionsFor(question: QuizQuestion) {
  const options = question.options ?? {};
  return {
    A: String(options.A ?? ""),
    B: String(options.B ?? ""),
    C: String(options.C ?? ""),
    D: String(options.D ?? ""),
  };
}

export function QuizView({ questions }: { questions: QuizQuestion[] }) {
  const [mode, setMode] = useState<"interactive" | "study">("interactive");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);

  const score = questions.reduce(
    (total, question, index) => total + (answers[index] === question.correct_option ? 1 : 0),
    0,
  );

  function paperMeta(question: QuizQuestion) {
    const unitNumber = question.syllabus_units?.unit_number ?? question.unit_number ?? 1;
    return unitNumber >= 101
      ? { paper: "PAPER_1" as const, label: "Paper 1 • Aptitude", className: "bg-amber-100 text-amber-900 border-amber-300" }
      : { paper: "PAPER_2" as const, label: "Paper 2 • Computer Science", className: "bg-[#dcefeb] text-[#174f49] border-[#75aaa1]" };
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#d8ddd5] bg-white p-2 shadow-sm">
        <button type="button" onClick={() => setMode("interactive")} className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold transition ${mode === "interactive" ? "bg-[#17324d] text-white" : "text-[#536174]"}`}>
          Interactive Quiz
        </button>
        <button type="button" onClick={() => setMode("study")} className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold transition ${mode === "study" ? "bg-[#17324d] text-white" : "text-[#536174]"}`}>
          Study Mode
        </button>
      </div>

      {mode === "interactive" ? (
        <>
          {submitted && (
            <div className="mb-5 rounded-2xl bg-[#17324d] px-5 py-4 text-white shadow-sm">
              <p className="text-sm font-bold text-[#b9d8d2]">Your score</p>
              <p className="text-3xl font-black">{score} / {questions.length}</p>
            </div>
          )}
          <div className="space-y-5">
            {questions.map((question, index) => {
              const options = optionsFor(question);
              const unitNumber = question.syllabus_units?.unit_number ?? question.unit_number;
              const unitName = question.syllabus_units?.unit_name;
              const paper = paperMeta(question);
              return (
                <article key={question.id ?? index} className="rounded-2xl border border-[#d8ddd5] bg-white p-5 shadow-[0_4px_18px_rgba(23,50,77,0.06)]">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${paper.className}`}>{paper.label}</span>
                    {unitNumber && <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Unit {unitNumber}{unitName ? `: ${unitName}` : ""}</span>}
                    <span className="rounded-full border border-[#d8bd82] bg-[#f7edcf] px-3 py-1 text-xs font-black text-[#65501f]">
                      {question.source_type === "PYQ" ? `Previous Year • ${question.exam_year ?? "NTA"}` : "AI Trend Practice"}
                    </span>
                  </div>
                  <h2 className="mb-4 text-base font-semibold leading-relaxed text-slate-950">Q{index + 1}. {question.question_text}</h2>
                  <div className="space-y-2">
                    {(["A", "B", "C", "D"] as const).map((key) => {
                      const selected = answers[index] === key;
                      let state = "border-slate-300 bg-slate-50 text-slate-900";
                      if (selected && !submitted) state = "border-[#14766d] bg-[#edf7f4] text-[#17324d]";
                      if (submitted && key === question.correct_option) state = "border-emerald-600 bg-emerald-50 text-emerald-950";
                      else if (submitted && selected) state = "border-rose-600 bg-rose-50 text-rose-950";
                      return (
                        <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm font-medium transition ${state}`}>
                          <input type="radio" name={`question-${index}`} checked={selected} disabled={submitted} onChange={() => setAnswers((current) => ({ ...current, [index]: key }))} className="mt-1 accent-[#14766d]" />
                          <span className="font-black">{key}.</span>
                          <span>{options[key]}</span>
                        </label>
                      );
                    })}
                  </div>
                  {submitted && (
                    <div className={`mt-4 rounded-xl border p-3 text-sm ${answers[index] === question.correct_option ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-rose-300 bg-rose-50 text-rose-950"}`}>
                      <div className="mb-1 flex items-center gap-2 font-black">
                        {answers[index] === question.correct_option ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        Correct answer: {question.correct_option}
                      </div>
                      <p className="font-medium leading-relaxed">{question.explanation}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <button type="button" disabled={submitted} onClick={() => setSubmitted(true)} className="mt-6 w-full rounded-xl bg-[#14766d] px-5 py-4 font-extrabold text-white shadow-[0_8px_20px_rgba(20,118,109,0.18)] disabled:cursor-not-allowed disabled:opacity-60">
            {submitted ? `Score: ${score} / ${questions.length}` : "Submit Quiz"}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-5">
            {questions.map((question, index) => {
              const options = optionsFor(question);
              const unitNumber = question.syllabus_units?.unit_number ?? question.unit_number;
              const unitName = question.syllabus_units?.unit_name;
              const paper = paperMeta(question);
              return (
                <article key={question.id ?? index} className="rounded-2xl border border-[#d8ddd5] bg-white p-5 shadow-[0_4px_18px_rgba(23,50,77,0.06)]">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${paper.className}`}>{paper.label}</span>
                    {unitNumber && <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Unit {unitNumber}{unitName ? `: ${unitName}` : ""}</span>}
                    <span className="rounded-full border border-[#d8bd82] bg-[#f7edcf] px-3 py-1 text-xs font-black text-[#65501f]">{question.source_type === "PYQ" ? `Previous Year • ${question.exam_year ?? "NTA"}` : "AI Trend Practice"}</span>
                  </div>
                  <h2 className="font-semibold leading-relaxed text-slate-950">Q{index + 1}. {question.question_text}</h2>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {(["A", "B", "C", "D"] as const).map((key) => (
                      <div key={key} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900"><b className="mr-2">{key}.</b>{options[key]}</div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setRevealed((current) => ({ ...current, [index]: !current[index] }))} className="mt-4 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                    {revealed[index] ? "Hide Answer" : "Show Answer"}
                  </button>
                  {revealed[index] && (
                    <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
                      <b>Answer: {question.correct_option}</b>
                      <p className="mt-1 font-medium leading-relaxed">{question.explanation}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <button type="button" onClick={() => setAnswerKeyOpen((open) => !open)} className="mt-6 flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-5 py-4 font-black text-slate-950">
            Answer Key &amp; Explanations
            {answerKeyOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {answerKeyOpen && (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-300 bg-white p-5">
              {questions.map((question, index) => (
                <div key={question.id ?? index} className="border-b border-slate-200 pb-3 last:border-0">
                  <p className="font-black text-slate-950">Q{index + 1}. Answer: {question.correct_option}</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">{question.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
