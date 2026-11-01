import { describe, expect, it } from "vitest";
import { isPremium, premiumDaysLeft, premiumFirst, parseSticker } from "./premium";
import { MAX_EPISODE_FILE_BYTES, episodeFileError } from "./upload-limits";

const now = new Date("2026-11-01T12:00:00Z");

describe("premium", () => {
  it("is active only before premium_until", () => {
    expect(isPremium("2026-12-01T12:00:00Z", now)).toBe(true);
    expect(isPremium("2026-11-01T11:59:59Z", now)).toBe(false);
    expect(isPremium(null, now)).toBe(false);
  });
  it("counts 30 days left right after a 30 day trial starts", () => {
    expect(premiumDaysLeft(new Date(now.getTime() + 30 * 86_400_000).toISOString(), now)).toBe(30);
  });
  it("lists premium users first", () => {
    const rows = [{ id: "a", premium_until: null }, { id: "b", premium_until: "2027-01-01T00:00:00Z" }];
    expect(premiumFirst(rows, now).map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("recognises stickers", () => {
    expect(parseSticker("[sticker:creeper]")?.label).toBe("Creeper");
    expect(parseSticker("merhaba")).toBeNull();
  });
});

describe("episode upload limit", () => {
  it("is 50 GB", () => {
    expect(MAX_EPISODE_FILE_BYTES).toBe(50 * 1024 ** 3);
  });
  it("rejects files above 50 GB", () => {
    expect(episodeFileError(50 * 1024 ** 3 + 1)).not.toBeNull();
    expect(episodeFileError(1024 ** 3)).toBeNull();
  });
});
