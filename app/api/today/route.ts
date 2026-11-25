import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateNetMcq, type NetMcq } from "@/lib/gemini";
import { getSyllabusUnit } from "@/lib/syllabus";

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
    const pool = unused.length ? unused : (pyqs ?? []);
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

    const aiRows: any[] = [];
    const { data: allQuestions } = await supabaseAdmin
      .from("questions")
      .select("question_text")
      .limit(500);
    const avoidTexts = new Set(
      (allQuestions ?? []).map((row: any) => normalizedText(row.question_text)),
    );
    const slots: Array<{ paper: "PAPER_1" | "PAPER_2"; units: number[] }> = [
      { paper: "PAPER_1", units: [107, 102, 101, 106, 108] },
      { paper: "PAPER_1", units: [107, 102, 101, 106, 108] },
      { paper: "PAPER_2", units: [7, 4, 5, 9, 8, 1, 10, 6, 2, 3] },
      { paper: "PAPER_2", units: [7, 4, 5, 9, 8, 1, 10, 6, 2, 3] },
      { paper: "PAPER_2", units: [7, 4, 5, 9, 8, 1, 10, 6, 2, 3] },
      { paper: "PAPER_2", units: [7, 4, 5, 9, 8, 1, 10, 6, 2, 3] },
    ];

    for (let index = 0; index < slots.length; index++) {
      const slot = slots[index];
      const unitNumber = slot.units[(index + 2) % slot.units.length];
      const unit = getSyllabusUnit(unitNumber);
      let mcq: NetMcq | null = null;
      let lastGenerationError = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const candidate = await generateNetMcq(
            unit.unitNumber,
            unit.unitName,
            Array.from(avoidTexts).slice(0, 80),
            unit.paper,
          );
          const key = normalizedText(candidate.question_text);
          if (!key || avoidTexts.has(key)) continue;
          if (Object.values(candidate.options).some((option) => !option?.trim())) continue;
          mcq = candidate;
          avoidTexts.add(key);
          break;
        } catch (error) {
          lastGenerationError = error instanceof Error ? error.message : String(error);
          console.warn(`Gemini attempt ${attempt + 1}/3 failed for unit ${unit.unitNumber}:`, error);
        }
      }
      if (!mcq) {
        throw new Error(
          `Gemini could not generate a unique, valid question for Unit ${unit.unitNumber}. ${lastGenerationError}`,
        );
      }
      const canonicalInsert = await supabaseAdmin.from("questions").insert({
        paper: unit.paper,
        unit_number: unit.unitNumber,
        unit_name: unit.unitName,
        question_text: mcq!.question_text,
        option_a: mcq!.options.A,
        option_b: mcq!.options.B,
        option_c: mcq!.options.C,
        option_d: mcq!.options.D,
        correct_option: mcq!.correct_option,
        explanation: mcq!.explanation,
        source_type: "AI",
        exam_year: null,
        exam_session: null,
      }).select("*").single();
      let inserted = canonicalInsert;
      if (canonicalInsert.error?.code === "42703") {
        inserted = await supabaseAdmin.from("questions").insert({
          unit_number: unit.unitNumber,
          source_type: "AI",
          question_text: mcq!.question_text,
          options: mcq!.options,
          correct_option: mcq!.correct_option,
          explanation: mcq!.explanation,
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
      .insert({ quiz_date: date, question_ids: questionIds })
      .select("quiz_date");
    if (raceError?.code === "42703") {
      const legacyRace = await supabaseAdmin
        .from("daily_quizzes")
        .insert({ quiz_date: date, exam_target_date: "2026-12-14" })
        .select("quiz_date");
      raceError = legacyRace.error;
    }
    if (raceError && raceError.code !== "23505") throw raceError;

    const canonicalIds = questionIds;
    const publicationResult = await supabaseAdmin
      .from("publication_history")
      .upsert(canonicalIds.map((questionId) => ({
        question_id: questionId,
        published_date: date,
      })), { onConflict: "question_id" });
    if (publicationResult.error?.code === "42703") {
      const legacyPublication = await supabaseAdmin
        .from("publication_history")
        .upsert(canonicalIds.map((questionId, index) => ({
          question_id: questionId,
          quiz_date: date,
          question_order: index + 1,
        })), { onConflict: "question_id" });
      if (legacyPublication.error) throw legacyPublication.error;
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
