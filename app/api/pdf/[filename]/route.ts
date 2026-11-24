import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!/^[A-Za-z0-9_-]+\.pdf$/i.test(filename)) {
    return NextResponse.json({ error: "Invalid PDF filename" }, { status: 400 });
  }
  try {
    const file = await readFile(path.join(process.cwd(), "pyq_pdfs", filename));
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 });
  }
}
