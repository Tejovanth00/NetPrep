import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const GENERATION_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
] as const;
const ANSWER_KEYS = ["A", "B", "C", "D"] as const;

export type NetMcq = {
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: (typeof ANSWER_KEYS)[number];
  explanation: string;
};

export type NetQuestionPlan = {
  unitNumber: number;
  unitName: string;
  paper: "PAPER_1" | "PAPER_2";
};

function isTemporaryProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number; status_code?: number } | null)?.status
    ?? (error as { status_code?: number } | null)?.status_code;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
    || /\b(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|timeout/i.test(message);
}

function providerStatus(error: unknown) {
  const candidate = error as { status?: number; status_code?: number } | null;
  return candidate?.status ?? candidate?.status_code;
}

function retryDelayMs(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/retryDelay["']?\s*:\s*["']?(\d+(?:\.\d+)?)s/i);
  return match ? Number(match[1]) * 1000 : 0;
}

const mcqSchema = {
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
    correct_option: { type: Type.STRING, enum: [...ANSWER_KEYS] },
    explanation: { type: Type.STRING },
  },
  required: ["question_text", "options", "correct_option", "explanation"],
};

type ProviderRetryBudget = { remaining: number };

async function generateWithFallback(
  prompt: string,
  responseSchema: object,
  retryBudget: ProviderRetryBudget = { remaining: 1 },
) {
  if (!ai) throw new Error("GEMINI_API_KEY is not configured on the server.");

  let lastError: unknown;
  let lastModel: (typeof GENERATION_MODELS)[number] = GENERATION_MODELS[0];
  for (const model of GENERATION_MODELS) {
    lastModel = model;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: 8192,
        },
      });
      return { response, model };
    } catch (error) {
      lastError = error;
      if (!isTemporaryProviderError(error)) throw error;

      const waitMs = retryDelayMs(error);
      if (waitMs > 0 && waitMs <= 10000 && providerStatus(error) !== 503) {
        await new Promise((resolve) => setTimeout(resolve, waitMs + 250));
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema,
              maxOutputTokens: 8192,
            },
          });
          return { response, model };
        } catch (retryError) {
          lastError = retryError;
        }
      }

      console.warn(`Gemini ${model} temporarily unavailable; trying the next model.`);
    }
  }

  if (providerStatus(lastError) === 503 && retryBudget.remaining > 0) {
    retryBudget.remaining--;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const response = await ai.models.generateContent({
        model: lastModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          maxOutputTokens: 8192,
        },
      });
      return { response, model: lastModel };
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`All configured Gemini generation models are temporarily unavailable. ${detail}`);
}

function parseMcq(value: unknown, model: string): NetMcq {
  if (!value || typeof value !== "object") {
    throw new Error(`Gemini ${model} returned an invalid MCQ object.`);
  }
  const candidate = value as Partial<NetMcq>;
  if (
    typeof candidate.question_text !== "string" ||
    typeof candidate.explanation !== "string" ||
    !candidate.options ||
    typeof candidate.options !== "object" ||
    !ANSWER_KEYS.includes(candidate.correct_option as (typeof ANSWER_KEYS)[number]) ||
    ANSWER_KEYS.some((key) => typeof candidate.options?.[key] !== "string" || !candidate.options[key].trim())
  ) {
    throw new Error(`Gemini ${model} returned invalid question fields.`);
  }
  if (!candidate.question_text.trim() || !candidate.explanation.trim()) {
    throw new Error(`Gemini ${model} returned empty question text or explanation.`);
  }
  return candidate as NetMcq;
}

export async function generateNetMcq(
  unitNumber: number,
  unitName: string,
  avoidTopics: string[],
  paper: "PAPER_1" | "PAPER_2" = unitNumber >= 101 ? "PAPER_1" : "PAPER_2",
): Promise<NetMcq> {
  const paperPrompt = paper === "PAPER_1"
    ? `Create one authentic NTA UGC NET Paper 1 question for Unit ${unitNumber}: ${unitName}. Use syllabus-relevant aptitude concepts and realistic NTA formats.`
    : `Create one authentic NTA UGC NET Computer Science (Subject Code 87), Paper II question for Unit ${unitNumber}: ${unitName}. Use postgraduate syllabus concepts and realistic NTA difficulty.`;
  const prompt = `${paperPrompt}
Use exactly four plausible options and one correct answer. Independently solve the question and verify the answer key before responding. Give a concise step-by-step explanation.
Avoid repeating or paraphrasing these prior questions/topics: ${avoidTopics.slice(0, 25).join(" | ") || "none"}.
Return only the structured JSON object.`;
  const { response, model } = await generateWithFallback(prompt, mcqSchema);
  return parseMcq(JSON.parse(response.text ?? "{}"), model);
}

export async function generateDailyMcqs(
  plans: NetQuestionPlan[],
  avoidQuestions: string[],
): Promise<NetMcq[]> {
  if (plans.length > 10) {
    throw new Error(`Daily generation accepts at most 10 unit plans, received ${plans.length}.`);
  }
  if (plans.length === 0) {
    return [];
  }

  const generated: NetMcq[] = [];
  const seen = new Set<string>();
  const batchSize = 3;
  const retryBudget: ProviderRetryBudget = { remaining: 1 };

  for (let start = 0; start < plans.length; start += batchSize) {
    const batchPlans = plans.slice(start, start + batchSize);
    const batch = await generateDailyMcqBatch(batchPlans, avoidQuestions, retryBudget);
    for (const mcq of batch) {
      const normalized = mcq.question_text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(normalized)) {
        throw new Error(`Gemini returned duplicate questions in the daily set.`);
      }
      seen.add(normalized);
      generated.push(mcq);
    }
  }

  return generated;
}

async function generateDailyMcqBatch(
  plans: NetQuestionPlan[],
  avoidQuestions: string[],
  retryBudget: ProviderRetryBudget,
): Promise<NetMcq[]> {
  const list = plans.map((plan, index) =>
    `${index + 1}. ${plan.paper}, unit ${plan.unitNumber}: ${plan.unitName}`,
  ).join("\n");
  const prompt = `Generate exactly ${plans.length} distinct, exam-grade UGC NET MCQs in one response, one for each plan in this order:
${list}
Paper 1 questions must be General Teaching and Research Aptitude. Paper 2 questions must be Computer Science Subject Code 87. Match postgraduate NTA difficulty, use plausible distractors, and cover current syllabus concepts. Do not copy or closely paraphrase the prior questions below:
${avoidQuestions.slice(0, 25).map((text) => `- ${text.slice(0, 180)}`).join("\n") || "- none"}
For every question, independently solve it and check that correct_option matches the options. Explanations should show the key reasoning steps. Return exactly one question per plan, preserving the listed order.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            unit_number: { type: Type.INTEGER },
            question_text: { type: Type.STRING },
            options: mcqSchema.properties.options,
            correct_option: mcqSchema.properties.correct_option,
            explanation: { type: Type.STRING },
          },
          required: ["unit_number", "question_text", "options", "correct_option", "explanation"],
        },
      },
    },
    required: ["questions"],
  };

  const { response, model } = await generateWithFallback(prompt, responseSchema, retryBudget);
  let parsed: { questions?: unknown };
  try {
    parsed = JSON.parse(response.text ?? "") as { questions?: unknown };
  } catch {
    return splitInvalidBatch(plans, avoidQuestions, model, "invalid or truncated JSON", retryBudget);
  }
  const generatedQuestions = parsed.questions;
  if (!Array.isArray(generatedQuestions) || generatedQuestions.length !== plans.length) {
    const count = Array.isArray(generatedQuestions) ? generatedQuestions.length : 0;
    return splitInvalidBatch(
      plans,
      avoidQuestions,
      model,
      `returned ${count} questions; expected ${plans.length}`,
      retryBudget,
    );
  }

  const seen = new Set<string>();
  const result: NetMcq[] = [];
  try {
    for (let index = 0; index < generatedQuestions.length; index++) {
      const item = generatedQuestions[index];
      if (!item || typeof item !== "object" || !("unit_number" in item)) {
        throw new Error(`invalid question at position ${index + 1}`);
      }
      if (item.unit_number !== plans[index].unitNumber) {
        throw new Error(`wrong unit for question ${index + 1}`);
      }
      const mcq = parseMcq(item, model);
      const normalized = mcq.question_text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(normalized)) {
        throw new Error("duplicate questions in the batch");
      }
      seen.add(normalized);
      result.push(mcq);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return splitInvalidBatch(plans, avoidQuestions, model, detail, retryBudget);
  }
  return result;
}

async function splitInvalidBatch(
  plans: NetQuestionPlan[],
  avoidQuestions: string[],
  model: string,
  reason: string,
  retryBudget: ProviderRetryBudget,
): Promise<NetMcq[]> {
  if (plans.length === 1) {
    throw new Error(`Gemini ${model} returned an invalid question (${reason}).`);
  }
  console.warn(`Gemini ${model} returned ${reason}; retrying in smaller batches.`);
  const midpoint = Math.ceil(plans.length / 2);
  const first = await generateDailyMcqBatch(plans.slice(0, midpoint), avoidQuestions, retryBudget);
  const second = await generateDailyMcqBatch(plans.slice(midpoint), avoidQuestions, retryBudget);
  return [...first, ...second];
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
