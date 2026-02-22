import { describe, it, expect, vi, beforeEach } from "vitest";

// Email module reads RESEND_API_KEY at module level.
// In tests, it's not set, so sendEmail always uses dev/log mode.
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

import {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAgentMatchNotification,
  sendSavedSearchNotification,
} from "@/server/services/email";

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────
// sendEmail
// ──────────────────────────────────────────────────────────────
describe("sendEmail", () => {
  it("returns true in dev/test mode (no RESEND_API_KEY)", async () => {
    const result = await sendEmail({
      to: "user@test.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });

    expect(result).toBe(true);
  });

  it("logs recipient and subject", async () => {
    const logSpy = vi.mocked(console.log);

    await sendEmail({
      to: "user@test.com",
      subject: "Welcome",
      html: "<p>Body</p>",
    });

    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("user@test.com");
    expect(allLogOutput).toContain("Welcome");
  });

  it("logs text preview when available", async () => {
    const logSpy = vi.mocked(console.log);

    await sendEmail({
      to: "user@test.com",
      subject: "Test",
      html: "<p>HTML body</p>",
      text: "Plain text body",
    });

    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("Plain text body");
  });

  it("logs HTML preview when no text provided", async () => {
    const logSpy = vi.mocked(console.log);

    await sendEmail({
      to: "user@test.com",
      subject: "Test",
      html: "<p>HTML content here</p>",
    });

    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("HTML content here");
  });
});

// ──────────────────────────────────────────────────────────────
// sendVerificationEmail
// ──────────────────────────────────────────────────────────────
describe("sendVerificationEmail", () => {
  it("returns true and logs verification details", async () => {
    const logSpy = vi.mocked(console.log);

    const result = await sendVerificationEmail("user@test.com", "token-123");

    expect(result).toBe(true);
    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("user@test.com");
    expect(allLogOutput).toContain("Verify your email");
  });

  it("includes token in verification URL", async () => {
    const logSpy = vi.mocked(console.log);

    await sendVerificationEmail("user@test.com", "my-special-token");

    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("my-special-token");
  });
});

// ──────────────────────────────────────────────────────────────
// sendPasswordResetEmail
// ──────────────────────────────────────────────────────────────
describe("sendPasswordResetEmail", () => {
  it("returns true and logs reset details", async () => {
    const logSpy = vi.mocked(console.log);

    const result = await sendPasswordResetEmail("user@test.com", "reset-456");

    expect(result).toBe(true);
    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("user@test.com");
    expect(allLogOutput).toContain("Reset your password");
  });

  it("includes reset token in URL", async () => {
    const logSpy = vi.mocked(console.log);

    await sendPasswordResetEmail("user@test.com", "reset-token-xyz");

    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("reset-token-xyz");
  });
});

// ──────────────────────────────────────────────────────────────
// sendAgentMatchNotification
// ──────────────────────────────────────────────────────────────
describe("sendAgentMatchNotification", () => {
  it("returns true and logs match details", async () => {
    const logSpy = vi.mocked(console.log);

    const result = await sendAgentMatchNotification("buyer@test.com", {
      listingTitle: "BMW 3 Series",
      dealScore: 85,
      url: "https://turgo.lv/listing/bmw",
    });

    expect(result).toBe(true);
    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("buyer@test.com");
    expect(allLogOutput).toContain("BMW 3 Series");
  });

  it("includes deal score in notification", async () => {
    const logSpy = vi.mocked(console.log);

    await sendAgentMatchNotification("buyer@test.com", {
      listingTitle: "Phone",
      dealScore: 92,
      url: "https://turgo.lv/listing/phone",
    });

    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("92");
  });
});

// ──────────────────────────────────────────────────────────────
// sendSavedSearchNotification
// ──────────────────────────────────────────────────────────────
describe("sendSavedSearchNotification", () => {
  it("returns true and logs search notification", async () => {
    const logSpy = vi.mocked(console.log);

    const result = await sendSavedSearchNotification("user@test.com", {
      searchName: "Cheap laptops",
      matchCount: 3,
      listings: [
        { title: "Dell Laptop", price: 200, url: "https://turgo.lv/dell" },
        { title: "HP Laptop", price: 150, url: "https://turgo.lv/hp" },
      ],
      manageUrl: "https://turgo.lv/dashboard/saved-searches",
    });

    expect(result).toBe(true);
    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("user@test.com");
    expect(allLogOutput).toContain("Cheap laptops");
  });

  it("handles single match count", async () => {
    const logSpy = vi.mocked(console.log);

    await sendSavedSearchNotification("user@test.com", {
      searchName: "My search",
      matchCount: 1,
      listings: [{ title: "Item", price: 100, url: "/item" }],
      manageUrl: "/manage",
    });

    const allLogOutput = logSpy.mock.calls.flat().join(" ");
    expect(allLogOutput).toContain("My search");
  });
});
