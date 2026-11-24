import { SYLLABUS_UNITS, type Paper } from "@/lib/syllabus";

export type Attempt = {
  questionId: string;
  paper: Paper;
  unitNumber: number;
  selectedOption: "A" | "B" | "C" | "D";
  isCorrect: boolean;
  mode: "DAILY" | "PRACTICE";
  answeredAt: string;
};

type Progress = {
  attempts: Record<string, Attempt>;
  dailyHistory: Record<string, { date: string; completed: boolean; score: number; total: number }>;
  bookmarks: string[];
};

const KEY = "netprep_progress_v1";
const EMPTY: Progress = { attempts: {}, dailyHistory: {}, bookmarks: [] };

function read(): Progress {
  if (typeof window === "undefined") return EMPTY;
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return EMPTY;
  }
}

function write(progress: Progress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(progress));
  window.dispatchEvent(new Event("netprep-progress"));
}

export function recordAttempt(attempt: Attempt) {
  const progress = read();
  progress.attempts[attempt.questionId] = attempt;
  write(progress);
}

export function completeDailyQuiz(date: string, score: number, total: number) {
  const progress = read();
  progress.dailyHistory[date] = { date, completed: true, score, total };
  write(progress);
}

export function getCurrentStreak(todayIST: string) {
  const history = read().dailyHistory;
  let cursor = new Date(`${todayIST}T12:00:00+05:30`);
  if (!history[todayIST]?.completed) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (true) {
    const date = cursor.toISOString().slice(0, 10);
    if (!history[date]?.completed) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function toggleBookmark(questionId: string) {
  const progress = read();
  progress.bookmarks = progress.bookmarks.includes(questionId)
    ? progress.bookmarks.filter((id) => id !== questionId)
    : [...progress.bookmarks, questionId];
  write(progress);
  return progress.bookmarks.includes(questionId);
}

export function getBookmarks() {
  return read().bookmarks;
}

export function getAttempts() {
  return Object.values(read().attempts);
}

export function getUnitStats() {
  const attempts = getAttempts();
  return SYLLABUS_UNITS.map((unit) => {
    const matching = attempts.filter((attempt) => attempt.unitNumber === unit.unitNumber);
    const correct = matching.filter((attempt) => attempt.isCorrect).length;
    return {
      unitNumber: unit.unitNumber,
      unitName: unit.unitName,
      paper: unit.paper,
      attempted: matching.length,
      correct,
      accuracy: matching.length ? Math.round((correct / matching.length) * 100) : 0,
    };
  });
}

export function exportProgressJSON() {
  return JSON.stringify(read(), null, 2);
}

export function resetProgress() {
  write(EMPTY);
}
