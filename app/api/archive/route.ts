import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSyllabusUnit } from "@/lib/syllabus";

function normalize(row: any) {
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

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");

  if (!date) {
    const daily = await supabaseAdmin
      .from("daily_quizzes")
      .select("quiz_date")
      .order("quiz_date", { ascending: false });
    if (daily.error) return NextResponse.json({ error: daily.error.message }, { status: 500 });

    const published = await supabaseAdmin
      .from("publication_history")
      .select("published_date")
      .order("published_date", { ascending: false });
    const dates = new Set((daily.data ?? []).map((row: any) => row.quiz_date));
    if (!published.error) {
      for (const row of published.data ?? []) {
        if (row.published_date) dates.add(row.published_date);
      }
    }
    return NextResponse.json({
      dates: Array.from(dates).sort((a, b) => b.localeCompare(a)).map((quiz_date) => ({ quiz_date })),
    });
  }

  const canonical = await supabaseAdmin
    .from("daily_quizzes")
    .select("question_ids")
    .eq("quiz_date", date)
    .maybeSingle();
  let ids: string[] = canonical.data?.question_ids ?? [];

  if (!ids.length) {
    const legacy = await supabaseAdmin
      .from("publication_history")
      .select("question_id")
      .eq("quiz_date", date)
      .order("question_order", { ascending: true });
    if (!legacy.error) ids = (legacy.data ?? []).map((row: any) => row.question_id);
  }

  if (!ids.length) {
    const publishedDate = await supabaseAdmin
      .from("publication_history")
      .select("question_id")
      .eq("published_date", date);
    if (!publishedDate.error) ids = (publishedDate.data ?? []).map((row: any) => row.question_id);
  }

  if (!ids.length) {
    return NextResponse.json({ date, questions: [] });
  }

  const result = await supabaseAdmin
    .from("questions")
    .select("*")
    .in("id", ids);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  const byId = new Map((result.data ?? []).map((row: any) => [row.id, normalize(row)]));
  return NextResponse.json({
    date,
    questions: ids.map((id) => byId.get(id)).filter(Boolean),
  });
}
