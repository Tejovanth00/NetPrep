import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const unit = request.nextUrl.searchParams.get("unit");
  const year = request.nextUrl.searchParams.get("year");
  const search = request.nextUrl.searchParams.get("search");
  const source = request.nextUrl.searchParams.get("source");
  const paper = request.nextUrl.searchParams.get("paper");

  let query = supabase
    .from("questions")
    .select("*")
    .eq("source_type", "PYQ")
    .order("created_at", { ascending: false });
  if (unit) query = query.eq("unit_number", Number(unit));
  if (year) query = query.eq("exam_year", Number(year));
  if (search) query = query.ilike("question_text", `%${search}%`);
  if (source) query = query.eq("source_type", source);
  if (paper) query = query.eq("paper", paper);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    questions: (data ?? []).map((row: any) => ({
      ...row,
      paper: row.paper ?? (row.unit_number >= 101 ? "PAPER_1" : "PAPER_2"),
      unit_name: row.unit_name ?? "",
      options: {
        A: row.option_a ?? row.options?.A ?? "",
        B: row.option_b ?? row.options?.B ?? "",
        C: row.option_c ?? row.options?.C ?? "",
        D: row.option_d ?? row.options?.D ?? "",
      },
    })),
  });
}
