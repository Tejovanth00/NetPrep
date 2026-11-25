import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const GENERATION_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
] as const;

export type NetMcq = {
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
};

function isTemporaryProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number; status_code?: number } | null)?.status
    ?? (error as { status_code?: number } | null)?.status_code;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
    || /\b(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|timeout/i.test(message);
}

async function generateWithFallback(prompt: string) {
  if (!ai) throw new Error("GEMINI_API_KEY is not configured on the server.");

  let lastError: unknown;
  for (const model of GENERATION_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question_text: { type: Type.STRING },
              options: {
                type: Type.OBJECT,
                properties: {
                  A: { type: Type.STRING },
                  B: { type: Type.STRING },
                  C: { type: Type.STRING },
                  D: { type: Type.STRING },
                },
                required: ["A", "B", "C", "D"],
              },
              correct_option: { type: Type.STRING, enum: ["A", "B", "C", "D"] },
              explanation: { type: Type.STRING },
            },
            required: ["question_text", "options", "correct_option", "explanation"],
          },
        },
      });
      return { response, model };
    } catch (error) {
      lastError = error;
      if (!isTemporaryProviderError(error)) throw error;
      console.warn(`Gemini ${model} temporarily unavailable; trying fallback model.`);
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`All configured Gemini generation models are temporarily unavailable. ${detail}`);
}

export async function generateNetMcq(
  unitNumber: number,
  unitName: string,
  avoidTopics: string[],
  paper: "PAPER_1" | "PAPER_2" = unitNumber >= 101 ? "PAPER_1" : "PAPER_2",
): Promise<NetMcq> {
  const paperPrompt = paper === "PAPER_1"
    ? `Create one authentic NTA UGC NET Paper 1 (General Teaching & Research Aptitude) question.
Use realistic formats such as Assertion-Reason, Statement I & II, teaching/research scenarios, number/letter series,
syllogisms or Indian Logic Pramanas, ICT, communication, reading comprehension, data interpretation, or Higher Education.
Target Unit ${unitNumber}: ${unitName}.`
    : `Create one authentic NTA UGC NET Computer Science (Subject Code 87), Paper II question.
Use recent 2024-2026 NTA trends: numericals, recurrence or complexity, SQL/normalization, OS scheduling/paging,
TOC/automata, compiler concepts, or networking protocols as appropriate.
Target Unit ${unitNumber}: ${unitName}.`;
  const prompt = `${paperPrompt}
Match authentic NTA wording, distractors, difficulty, and single-best-answer conventions.
Avoid these topics or recent formulations: ${avoidTopics.join(", ") || "none"}.
The question must be precise, self-contained, and have exactly one correct answer.
Do not include Q/Paper/year references. Provide a concise conceptual explanation.`;

  const { response, model } = await generateWithFallback(prompt);
  const parsed: unknown = JSON.parse(response.text ?? "{}");
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("question_text" in parsed) ||
    !("options" in parsed) ||
    !("correct_option" in parsed) ||
    !("explanation" in parsed)
  ) {
    throw new Error(`Gemini ${model} returned an incomplete MCQ response.`);
  }
  const mcq = parsed as NetMcq;
  if (
    !mcq.question_text.trim() ||
    !mcq.explanation.trim() ||
    !["A", "B", "C", "D"].includes(mcq.correct_option) ||
    (["A", "B", "C", "D"] as const).some((key) => !mcq.options[key]?.trim())
  ) {
    throw new Error(`Gemini ${model} returned invalid question fields.`);
  }

  if (!ai) return mcq;
  try {
    const verification = await ai.models.generateContent({
    model,
    contents: `Verify the answer key for this MCQ. Return only JSON:
{"matches_correct_option":true|false,"correct_option":"A"| "B"| "C"| "D","reason":"brief"}
Question: ${mcq.question_text}
Options: ${JSON.stringify(mcq.options)}
Candidate correct_option: ${mcq.correct_option}`,
      config: { responseMimeType: "application/json" },
    });
    const checked = JSON.parse(verification.text ?? "{}") as {
      matches_correct_option?: boolean;
      correct_option?: "A" | "B" | "C" | "D";
    };
    if (
      checked.matches_correct_option === false &&
      checked.correct_option &&
      ["A", "B", "C", "D"].includes(checked.correct_option)
    ) {
      mcq.correct_option = checked.correct_option;
    }
  } catch (error) {
    console.warn(`Gemini answer verification failed on ${model}; keeping generated answer key.`, error);
  }

  return mcq;
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (!ai) throw new Error("GEMINI_API_KEY is not configured on the server.");
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length !== 768) {
    throw new Error("Embedding did not return a 768-dimension vector");
  }
  return values;
}
