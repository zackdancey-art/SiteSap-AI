import OpenAI from "openai";

let _client: OpenAI | null = null;

// ── Test-mode boundary mock (mirrors the notificationService H3a guard) ───────
// In NODE_ENV=test we NEVER construct a real client or make a network call.
// Instead we return a fake whose `responses.create` records the request `input`
// (so tests can assert which images were/weren't sent to the model) and returns
// a canned valid response. This keeps the vision code path exercisable without
// exporting internal functions or hitting OpenAI.
type RecordedOpenAICall = { input: unknown };
const recordedCalls: RecordedOpenAICall[] = [];

export function getRecordedOpenAICallsForTests(): RecordedOpenAICall[] {
  return recordedCalls;
}
export function resetOpenAIRecordingForTests(): void {
  recordedCalls.length = 0;
}

function makeTestClient(): OpenAI {
  return {
    responses: {
      create: async (args: { input: unknown }) => {
        recordedCalls.push({ input: args?.input });
        return {
          output_text: JSON.stringify({
            summary: "test",
            fullReport: "test",
            safetyChecklist: [],
            sections: [],
          }),
        };
      },
    },
  } as unknown as OpenAI;
}

export function getOpenAIClient(): OpenAI {
  if (process.env.NODE_ENV === "test") {
    return makeTestClient();
  }
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is missing. Add it to services/api/.env");
    }
    _client = new OpenAI({
      apiKey,
      timeout: 90_000,
      maxRetries: 2,
    });
  }
  return _client;
}

export function resetOpenAIClient(): void {
  _client = null;
}
