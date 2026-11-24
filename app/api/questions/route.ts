import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function normalizeQuestion(row: any) {
  return {
    ...row,
    paper: row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2"),
    unit_name: row.unit_name ?? "",
    options: {
      A: row.option_a ?? row.options?.A ?? "",
      B: row.option_b ?? row.options?.B ?? "",
      C: row.option_c ?? row.options?.C ?? "",
      D: row.option_d ?? row.options?.D ?? "",
    },
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const paper = params.get("paper");
  const unit = params.get("unit");
  const source = params.get("source");
  const year = params.get("year");
  const search = params.get("search");
  const ids = params.get("ids");
  const random = params.get("random") === "true";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? "30") || 30));
  const from = (page - 1) * limit;
  const to = random ? Math.min(limit - 1, 99) : from + limit - 1;

  let query = supabase.from("questions").select("*", { count: "exact" });
  if (paper) query = query.eq("paper", paper);
  if (unit) query = query.eq("unit_number", Number(unit));
  if (source) query = query.eq("source_type", source === "Official PYQ" ? "PYQ" : source === "AI Generated" ? "AI" : source);
  if (year) query = query.eq("exam_year", Number(year));
  if (search) query = query.ilike("question_text", `%${search}%`);
  if (ids) query = query.in("id", ids.split(",").filter(Boolean));

  query = random
    ? query.range(0, to)
    : query.range(from, to).order("created_at", { ascending: false });

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const normalized = (data ?? []).map(normalizeQuestion);
  const result = random
    ? normalized.sort(() => Math.random() - 0.5).slice(0, limit)
    : normalized;
  const yearsResult = await supabase
    .from("questions")
    .select("exam_year")
    .not("exam_year", "is", null);
  const years = Array.from(new Set((yearsResult.data ?? []).map((row: any) => row.exam_year)))
    .sort((a: number, b: number) => b - a);
  return NextResponse.json({ questions: result, total: count ?? result.length, years });
}
