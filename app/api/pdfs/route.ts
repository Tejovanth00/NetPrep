import { NextRequest, NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

export async function GET(_request: NextRequest) {
  const directory = path.join(process.cwd(), "pyq_pdfs");
  try {
    const names = (await readdir(directory))
      .filter((name) => name.toLowerCase().endsWith(".pdf"))
      .sort((a, b) => b.localeCompare(a));
    return NextResponse.json({ pdfs: names });
  } catch {
    return NextResponse.json({ pdfs: [] });
  }
}
