import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateDailyMcqs, type NetMcq, type NetQuestionPlan } from "@/lib/gemini";
import { getSyllabusUnit } from "@/lib/syllabus";

export const maxDuration = 60;

function todayIST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeQuestion(row: any) {
  return {
    id: row.id,
    paper: row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2"),
    unit_number: row.unit_number,
    unit_name: row.unit_name ?? getSyllabusUnit(row.unit_number).unitName,
    question_text: row.question_text,
    options: {
      A: row.option_a ?? row.options?.A ?? "",
      B: row.option_b ?? row.options?.B ?? "",
      C: row.option_c ?? row.options?.C ?? "",
      D: row.option_d ?? row.options?.D ?? "",
    },
    correct_option: row.correct_option,
    explanation: row.explanation,
    source_type: row.source_type,
    exam_year: row.exam_year,
    exam_session: row.exam_session,
  };
}

function normalizedText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function randomizeOptions(mcq: NetMcq): NetMcq {
  const entries = (["A", "B", "C", "D"] as const).map((key) => ({
    originalKey: key,
    text: mcq.options[key],
  }));
  for (let index = entries.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [entries[index], entries[randomIndex]] = [entries[randomIndex], entries[index]];
  }

  const options = { A: "", B: "", C: "", D: "" };
  let correctOption: NetMcq["correct_option"] = "A";
  entries.forEach((entry, index) => {
    const newKey = (["A", "B", "C", "D"] as const)[index];
    options[newKey] = entry.text;
    if (entry.originalKey === mcq.correct_option) correctOption = newKey;
  });
  return { ...mcq, options, correct_option: correctOption };
}

async function fetchByIds(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((row: any) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map(normalizeQuestion);
}

async function existingToday(date: string) {
  const canonical = await supabaseAdmin
    .from("daily_quizzes")
    .select("question_ids")
    .eq("quiz_date", date)
    .maybeSingle();
  if (!canonical.error && canonical.data?.question_ids?.length === 10) {
    return fetchByIds(canonical.data.question_ids);
  }

  if (canonical.error?.code !== "42703") {
    if (canonical.error) throw canonical.error;
  }

  const legacy = await supabaseAdmin
    .from("publication_history")
    .select("question_id")
    .eq("quiz_date", date)
    .order("question_order", { ascending: true })
    .limit(10);
  if (!legacy.error && legacy.data?.length === 10) {
    return fetchByIds(legacy.data.map((row: any) => row.question_id));
  }
  return null;
}

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("date");
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
    ? requested
    : todayIST();

  try {
    const existing = await existingToday(date);
    if (existing) return NextResponse.json({ date, questions: existing });
    if (date !== todayIST()) {
      return NextResponse.json({ error: `No 10-question quiz is published for ${date}.` }, { status: 404 });
    }

    const { data: pyqs, error: pyqError } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("source_type", "PYQ")
      .limit(100);
    if (pyqError) throw pyqError;

    const { data: published, error: publishedError } = await supabaseAdmin
      .from("publication_history")
      .select("question_id");
    if (publishedError) throw publishedError;
    const used = new Set((published ?? []).map((row: any) => row.question_id));

    const unused = (pyqs ?? []).filter((row: any) => !used.has(row.id));
    const pool = unused;
    const paper1 = pool.filter((row: any) => (row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2")) === "PAPER_1");
    const paper2 = pool.filter((row: any) => (row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2")) === "PAPER_2");
    const selectedPyqs = [
      ...paper1.slice(0, 1),
      ...paper2.slice(0, 3),
      ...pool.filter((row: any) =>
        row !== paper1[0] &&
        row !== paper2[0] &&
        row !== paper2[1] &&
        row !== paper2[2]
      ).slice(0, Math.max(0, 4 - (paper1.slice(0, 1).length + paper2.slice(0, 3).length))),
    ].filter((row, index, rows) => rows.findIndex((item) => item.id === row.id) === index).slice(0, 4);

    const { data: allQuestions, error: priorQuestionsError } = await supabaseAdmin
      .from("questions")
      .select("*")
      .limit(500);
    if (priorQuestionsError) throw priorQuestionsError;
    const avoidTexts = new Set(
      (allQuestions ?? []).map((row: any) => normalizedText(row.question_text)),
    );
    const paper1PyqCount = selectedPyqs.filter((row: any) =>
      (row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2")) === "PAPER_1",
    ).length;
    const aiCount = 10 - selectedPyqs.length;
    const paper1AiCount = Math.min(aiCount, Math.max(0, 3 - paper1PyqCount));
    const paper2AiCount = aiCount - paper1AiCount;
    const paper1Priority = [107, 102, 101, 106, 108, 105, 110, 103, 104, 109];
    const paper2Priority = [7, 5, 4, 9, 8, 1, 10, 6, 2, 3];
    const isGenericFallback = (text: string) => {
      const normalized = normalizedText(text);
      return normalized.includes("formal modeling and systematic analysis")
        || normalized.includes("principle for evaluating an academic or teaching scenario");
    };
    const unusedAi = (allQuestions ?? []).filter((row: any) => {
      if (row.source_type !== "AI" || used.has(row.id) || isGenericFallback(row.question_text ?? "")) return false;
      if (!["A", "B", "C", "D"].includes(row.correct_option)) return false;
      const question = normalizeQuestion(row);
      return Object.values(question.options).every((option) => option.trim().length > 0);
    });
    const selectExistingAi = (
      paper: "PAPER_1" | "PAPER_2",
      priority: number[],
      count: number,
    ) => {
      if (count <= 0) return [];
      const candidates = unusedAi
        .filter((row: any) =>
          (row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2")) === paper,
        )
        .sort((left: any, right: any) => {
          const unitOrder = priority.indexOf(left.unit_number) - priority.indexOf(right.unit_number);
          if (unitOrder !== 0) return unitOrder;
          return String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
        });
      const selected: any[] = [];
      const representedUnits = new Set<number>();
      const seenText = new Set<string>();
      for (const row of candidates) {
        const key = normalizedText(row.question_text);
        if (!key || seenText.has(key) || representedUnits.has(row.unit_number)) continue;
        selected.push(row);
        seenText.add(key);
        representedUnits.add(row.unit_number);
        if (selected.length === count) break;
      }
      if (selected.length < count) {
        for (const row of candidates) {
          const key = normalizedText(row.question_text);
          if (!key || seenText.has(key)) continue;
          selected.push(row);
          seenText.add(key);
          if (selected.length === count) break;
        }
      }
      return selected;
    };
    const existingAiRows = [
      ...selectExistingAi("PAPER_1", paper1Priority, paper1AiCount),
      ...selectExistingAi("PAPER_2", paper2Priority, paper2AiCount),
    ];
    const createPlans = (
      paper: "PAPER_1" | "PAPER_2",
      priority: number[],
      count: number,
    ): NetQuestionPlan[] => {
      const alreadyRepresented = new Set(
        [...selectedPyqs, ...existingAiRows]
          .filter((row: any) => (row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2")) === paper)
          .map((row: any) => row.unit_number),
      );
      const ordered = [
        ...priority.filter((unitNumber) => !alreadyRepresented.has(unitNumber)),
        ...priority.filter((unitNumber) => alreadyRepresented.has(unitNumber)),
      ];
      return ordered.slice(0, count).map((unitNumber) => {
        const unit = getSyllabusUnit(unitNumber);
        return { unitNumber, unitName: unit.unitName, paper };
      });
    };
    const paper1ExistingAiCount = existingAiRows.filter((row: any) =>
      (row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2")) === "PAPER_1",
    ).length;
    const paper2ExistingAiCount = existingAiRows.length - paper1ExistingAiCount;
    const plans = [
      ...createPlans("PAPER_1", paper1Priority, paper1AiCount - paper1ExistingAiCount),
      ...createPlans("PAPER_2", paper2Priority, paper2AiCount - paper2ExistingAiCount),
    ];
    const generated = plans.length
      ? await generateDailyMcqs(
        plans,
        Array.from(avoidTexts),
      )
      : [];

    const aiRows: any[] = [...existingAiRows];
    for (let index = 0; index < plans.length; index++) {
      const plan = plans[index];
      const unit = getSyllabusUnit(plan.unitNumber);
      const mcq = randomizeOptions(generated[index]);
      const key = normalizedText(mcq.question_text);
      if (!key || avoidTexts.has(key)) {
        throw new Error(`Gemini returned a repeated question for Unit ${unit.unitNumber}.`);
      }
      avoidTexts.add(key);
      const canonicalInsert = await supabaseAdmin.from("questions").insert({
        paper: unit.paper,
        unit_number: unit.unitNumber,
        unit_name: unit.unitName,
        question_text: mcq.question_text,
        options: mcq.options,
        option_a: mcq.options.A,
        option_b: mcq.options.B,
        option_c: mcq.options.C,
        option_d: mcq.options.D,
        correct_option: mcq.correct_option,
        explanation: mcq.explanation,
        source_type: "AI",
        exam_year: null,
        exam_session: null,
      }).select("*").single();
      let inserted = canonicalInsert;
      if (canonicalInsert.error?.code === "42703") {
        inserted = await supabaseAdmin.from("questions").insert({
          unit_number: unit.unitNumber,
          source_type: "AI",
          question_text: mcq.question_text,
          options: mcq.options,
          correct_option: mcq.correct_option,
          explanation: mcq.explanation,
          exam_year: null,
          exam_session: null,
        }).select("*").single();
      }
      if (inserted.error) throw inserted.error;
      aiRows.push(inserted.data);
    }

    const questionIds = [
      ...selectedPyqs.map((row: any) => row.id),
      ...aiRows.map((row: any) => row.id),
    ].slice(0, 10);
    if (questionIds.length !== 10) throw new Error("Could not prepare exactly 10 questions");

    let { error: raceError } = await supabaseAdmin
      .from("daily_quizzes")
      .insert({
        quiz_date: date,
        question_ids: questionIds,
        exam_target_date: "2026-12-14",
      })
      .select("quiz_date");
    if (raceError?.code === "42703") {
      const canonicalRace = await supabaseAdmin
        .from("daily_quizzes")
        .insert({ quiz_date: date, question_ids: questionIds })
        .select("quiz_date");
      raceError = canonicalRace.error;
      if (raceError?.code === "42703") {
        const legacyRace = await supabaseAdmin
          .from("daily_quizzes")
          .insert({ quiz_date: date, exam_target_date: "2026-12-14" })
          .select("quiz_date");
        raceError = legacyRace.error;
      }
    }
    if (raceError && raceError.code !== "23505") throw raceError;

    const canonicalIds = questionIds;
    const publicationResult = await supabaseAdmin
      .from("publication_history")
      .upsert(canonicalIds.map((questionId, index) => ({
        question_id: questionId,
        published_date: date,
        quiz_date: date,
        question_order: index + 1,
      })), { onConflict: "question_id" });
    if (publicationResult.error?.code === "42703") {
      const canonicalPublication = await supabaseAdmin
        .from("publication_history")
        .upsert(canonicalIds.map((questionId) => ({
          question_id: questionId,
          published_date: date,
        })), { onConflict: "question_id" });
      if (canonicalPublication.error?.code === "42703") {
        const legacyPublication = await supabaseAdmin
          .from("publication_history")
          .upsert(canonicalIds.map((questionId, index) => ({
            question_id: questionId,
            quiz_date: date,
            question_order: index + 1,
          })), { onConflict: "question_id" });
        if (legacyPublication.error) throw legacyPublication.error;
      } else if (canonicalPublication.error) {
        throw canonicalPublication.error;
      }
    } else if (publicationResult.error) {
      throw publicationResult.error;
    }

    const afterRace = await existingToday(date);
    if (!afterRace) throw new Error("Could not persist today's canonical quiz");

    return NextResponse.json({ date, questions: afterRace });
  } catch (error: any) {
    console.error("today route failed", { date, message: error?.message });
    return NextResponse.json(
      { error: error?.message ?? "Unable to prepare today's quiz." },
      { status: error?.status ?? 500 },
    );
  }
}
