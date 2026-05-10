import { describe, it, expect } from "vitest";
import {
  extractJsonCandidate,
  safeParseJsonWithSchema,
  secondOpinionSchema,
  critiquesSchema,
  comparisonVerdictSchema,
} from "@/lib/ai-schema";

describe("ai-schema", () => {
  describe("extractJsonCandidate", () => {
    it("returns input when already clean JSON", () => {
      expect(extractJsonCandidate('{"a":1}')).toBe('{"a":1}');
    });

    it("strips ```json fences", () => {
      const input = '```json\n{"a":1}\n```';
      expect(extractJsonCandidate(input)).toBe('{"a":1}');
    });

    it("strips plain ``` fences", () => {
      const input = '```\n{"a":1}\n```';
      expect(extractJsonCandidate(input)).toBe('{"a":1}');
    });

    it("extracts JSON from surrounding prose", () => {
      const input = 'Here is the result:\n{"verdict":"ok"}\nHope that helps.';
      expect(extractJsonCandidate(input)).toBe('{"verdict":"ok"}');
    });

    it("handles arrays", () => {
      expect(extractJsonCandidate("noise [1,2,3] more")).toBe("[1,2,3]");
    });
  });

  describe("safeParseJsonWithSchema", () => {
    it("returns ok for valid payload", () => {
      const text = '{"verdict":"Menarik","conviction":70}';
      const result = safeParseJsonWithSchema(text, secondOpinionSchema);
      expect(result.ok).toBe(true);
      expect(result.data?.verdict).toBe("Menarik");
      expect(result.data?.conviction).toBe(70);
    });

    it("returns ok when wrapped in fences", () => {
      const text = '```json\n{"verdict":"Ok"}\n```';
      const result = safeParseJsonWithSchema(text, secondOpinionSchema);
      expect(result.ok).toBe(true);
    });

    it("returns error on broken JSON", () => {
      const result = safeParseJsonWithSchema("not json at all", secondOpinionSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/JSON parse/);
    });

    it("returns error when schema mismatches", () => {
      // conviction must be 0-100; 200 should fail
      const result = safeParseJsonWithSchema(
        '{"verdict":"ok","conviction":200}',
        secondOpinionSchema,
      );
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Schema/);
    });

    it("validates critiques record", () => {
      const text = '{"critiques":{"BBRI":"ok","TLKM":"bagus"}}';
      const result = safeParseJsonWithSchema(text, critiquesSchema);
      expect(result.ok).toBe(true);
      expect(result.data?.critiques.BBRI).toBe("ok");
    });

    it("validates comparison verdict", () => {
      const text = '{"winner":"BBRI","reasons":["score tinggi","RR bagus"]}';
      const result = safeParseJsonWithSchema(text, comparisonVerdictSchema);
      expect(result.ok).toBe(true);
      expect(result.data?.winner).toBe("BBRI");
    });
  });
});
