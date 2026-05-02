import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDiaryFromEntries } from "./ai";

test("buildDiaryFromEntries creates defaults for missing fields", () => {
  const result = buildDiaryFromEntries([{ notes: "Installed framing" }]);

  assert.match(result.summary, /Compiled from 1 entry/i);
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0].workCompleted, "Installed framing");
  assert.equal(result.sections[0].weather, "Not recorded");
  assert.equal(result.sections[0].photoAnalysis, "N/A");
  assert.equal(result.sections[0].safetyObservations, "N/A");
  assert.equal(result.reportPeriod, "daily");
  assert.ok(result.fullReport.length > 20);
  assert.equal(result.safetyChecklist.length, 0);
});

test("buildDiaryFromEntries pluralizes summary", () => {
  const result = buildDiaryFromEntries([{ notes: "A" }, { notes: "B" }]);
  assert.match(result.summary, /Compiled from 2 entries/i);
});

test("buildDiaryFromEntries keeps safety checklist to explicit observations only", () => {
  const result = buildDiaryFromEntries([
    {
      notes: "PPE checked before shift. Barrier secured near trench.",
      photos: [{ caption: "Safety signage visible at gate." }],
    },
  ]);

  assert.deepEqual(result.safetyChecklist, [
    "PPE checked before shift. Barrier secured near trench.",
    "Safety signage visible at gate.",
  ]);
});

test("buildDiaryFromEntries does not invent photo observations in fallback mode", () => {
  const result = buildDiaryFromEntries([
    {
      notes: "Bridge beam installation continued.",
      photos: [{ base64: "abc123", mimeType: "image/jpeg" }],
    },
  ]);

  assert.equal(result.sections[0].photoAnalysis, "N/A");
});
