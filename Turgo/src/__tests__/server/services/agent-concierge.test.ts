import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AI service before importing concierge
vi.mock("@/server/services/ai", () => ({
  aiComplete: vi.fn(),
}));

import { aiComplete } from "@/server/services/ai";
import {
  processConciergeMessage,
  detectLanguage,
} from "@/server/services/agent-concierge";

const mockAiComplete = vi.mocked(aiComplete);

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// detectLanguage
// ──────────────────────────────────────────────────────────────
describe("detectLanguage", () => {
  it("detects Russian from Cyrillic characters", () => {
    expect(detectLanguage("Привет, хочу продать")).toBe("ru");
  });

  it("detects Latvian from diacritical characters", () => {
    expect(detectLanguage("Gribu pārdot šo preci")).toBe("lv");
  });

  it("detects Lithuanian from specific diacritics", () => {
    expect(detectLanguage("Noriu parduoti daiktą")).toBe("lt");
  });

  it("detects Estonian from specific characters", () => {
    expect(detectLanguage("Tahan müüa seda kaupa")).toBe("et");
  });

  it("defaults to English for plain ASCII", () => {
    expect(detectLanguage("I want to sell my car")).toBe("en");
  });

  it("defaults to English for empty string", () => {
    expect(detectLanguage("")).toBe("en");
  });

  it("prioritizes Russian over other languages", () => {
    // Russian characters take priority in the check order
    expect(detectLanguage("Тест test")).toBe("ru");
  });
});

// ──────────────────────────────────────────────────────────────
// processConciergeMessage — AI-powered intent detection
// ──────────────────────────────────────────────────────────────
describe("processConciergeMessage", () => {
  describe("with AI available", () => {
    it("detects sell intent from AI response", async () => {
      mockAiComplete.mockResolvedValue({
        content: JSON.stringify({
          intent: "sell",
          message: "Let me help you sell!",
          suggestedActions: [{ label: "Upload photos", action: "sell_upload" }],
          detectedLanguage: "en",
        }),
        model: "test",
        provider: "github",
      });

      const result = await processConciergeMessage("I want to sell my car");

      expect(result.intent).toBe("sell");
      expect(result.message).toBe("Let me help you sell!");
      expect(result.suggestedActions).toHaveLength(1);
    });

    it("detects buy intent from AI response", async () => {
      mockAiComplete.mockResolvedValue({
        content: JSON.stringify({
          intent: "buy",
          message: "What are you looking for?",
          suggestedActions: [{ label: "Search", action: "search" }],
          detectedLanguage: "en",
        }),
        model: "test",
        provider: "github",
      });

      const result = await processConciergeMessage("Looking for a laptop");

      expect(result.intent).toBe("buy");
    });

    it("handles AI response wrapped in code blocks", async () => {
      mockAiComplete.mockResolvedValue({
        content:
          '```json\n{"intent":"sell","message":"OK","suggestedActions":[],"detectedLanguage":"en"}\n```',
        model: "test",
        provider: "github",
      });

      const result = await processConciergeMessage("sell");

      expect(result.intent).toBe("sell");
    });

    it("passes locale as language instruction", async () => {
      mockAiComplete.mockResolvedValue({
        content: JSON.stringify({
          intent: "browse",
          message: "Pārlūkosim!",
          suggestedActions: [],
          detectedLanguage: "lv",
        }),
        model: "test",
        provider: "github",
      });

      await processConciergeMessage("show me listings", [], "lv");

      expect(mockAiComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "system",
              content: expect.stringContaining("Atbildi latviešu valodā"),
            }),
          ]),
        }),
      );
    });

    it("includes conversation history in messages", async () => {
      mockAiComplete.mockResolvedValue({
        content: JSON.stringify({
          intent: "sell",
          message: "Continuing...",
          suggestedActions: [],
          detectedLanguage: "en",
        }),
        model: "test",
        provider: "github",
      });

      const history = [
        { role: "user" as const, content: "hello" },
        { role: "assistant" as const, content: "hi there" },
      ];

      await processConciergeMessage("I want to sell", history);

      const call = mockAiComplete.mock.calls[0][0];
      expect(call.messages).toHaveLength(4); // system + 2 history + user
    });
  });

  describe("fallback intent detection (AI unavailable)", () => {
    beforeEach(() => {
      mockAiComplete.mockRejectedValue(new Error("AI unavailable"));
    });

    it("detects sell intent from English keywords", async () => {
      const result = await processConciergeMessage("I want to sell my car");

      expect(result.intent).toBe("sell");
      expect(result.suggestedActions).toBeDefined();
      expect(result.suggestedActions!.length).toBeGreaterThan(0);
    });

    it("detects buy intent from English keywords", async () => {
      const result = await processConciergeMessage("I'm looking for a laptop");

      expect(result.intent).toBe("buy");
    });

    it("detects support intent", async () => {
      const result = await processConciergeMessage(
        "I have a problem with my account",
      );

      expect(result.intent).toBe("support");
    });

    it("detects browse intent", async () => {
      const result = await processConciergeMessage("Show me categories");

      expect(result.intent).toBe("browse");
    });

    it("defaults to 'other' for unrecognized messages", async () => {
      const result = await processConciergeMessage("Hello there");

      expect(result.intent).toBe("other");
      expect(result.suggestedActions!.length).toBeGreaterThan(0);
    });

    it("detects sell intent from Latvian keywords", async () => {
      const result = await processConciergeMessage("Gribu pārdot auto");

      expect(result.intent).toBe("sell");
      expect(result.data?.detectedLanguage).toBe("lv");
    });

    it("detects buy intent from Russian keywords", async () => {
      const result = await processConciergeMessage("Хочу купить телефон");

      expect(result.intent).toBe("buy");
      expect(result.data?.detectedLanguage).toBe("ru");
    });

    it("detects sell intent from Lithuanian keywords", async () => {
      const result = await processConciergeMessage("Noriu parduoti");

      expect(result.intent).toBe("sell");
    });

    it("detects sell intent from Estonian keywords", async () => {
      const result = await processConciergeMessage("Tahan müüa");

      expect(result.intent).toBe("sell");
    });

    it("detects support intent from Russian keywords", async () => {
      const result = await processConciergeMessage("Нужна помощь");

      expect(result.intent).toBe("support");
    });

    it("detects browse intent from Latvian keywords", async () => {
      const result = await processConciergeMessage("Parādīt sludinājumus");

      expect(result.intent).toBe("browse");
    });

    it("returns localized responses for Latvian", async () => {
      const result = await processConciergeMessage(
        "Gribu pārdot",
        undefined,
        "lv",
      );

      expect(result.intent).toBe("sell");
      expect(result.data?.detectedLanguage).toBe("lv");
    });

    it("returns localized responses for Russian", async () => {
      const result = await processConciergeMessage(
        "Продать машину",
        undefined,
        "ru",
      );

      expect(result.intent).toBe("sell");
      expect(result.data?.detectedLanguage).toBe("ru");
    });

    it("returns localized responses for Lithuanian", async () => {
      const result = await processConciergeMessage(
        "Noriu parduoti",
        undefined,
        "lt",
      );

      expect(result.intent).toBe("sell");
    });

    it("returns localized responses for Estonian", async () => {
      const result = await processConciergeMessage(
        "Tahan müüa",
        undefined,
        "et",
      );

      expect(result.intent).toBe("sell");
    });

    it("find/want keywords trigger buy intent", async () => {
      const result = await processConciergeMessage("I want to find a bicycle");

      expect(result.intent).toBe("buy");
    });

    it("browse keywords like 'search' detected", async () => {
      const result = await processConciergeMessage("search for items");

      expect(result.intent).toBe("browse");
    });

    it("problem/issue keywords trigger support intent", async () => {
      const result = await processConciergeMessage(
        "I have a problem with login",
      );

      expect(result.intent).toBe("support");
    });
  });

  describe("response structure", () => {
    beforeEach(() => {
      mockAiComplete.mockRejectedValue(new Error("AI unavailable"));
    });

    it("always includes intent field", async () => {
      const result = await processConciergeMessage("hello");

      expect(result).toHaveProperty("intent");
      expect(["sell", "buy", "support", "browse", "other"]).toContain(
        result.intent,
      );
    });

    it("always includes message field", async () => {
      const result = await processConciergeMessage("hello");

      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    });

    it("always includes suggestedActions array", async () => {
      const result = await processConciergeMessage("hello");

      expect(Array.isArray(result.suggestedActions)).toBe(true);
    });

    it("suggested actions have label and action", async () => {
      const result = await processConciergeMessage("I want to sell");

      for (const action of result.suggestedActions!) {
        expect(typeof action.label).toBe("string");
        expect(typeof action.action).toBe("string");
      }
    });
  });
});
