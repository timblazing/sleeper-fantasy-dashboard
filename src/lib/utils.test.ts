import { describe, expect, it } from "vitest";
import { cn, points, withUsername } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting tailwind classes, last one winning", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy values", () => {
    expect(cn("p-2", false && "hidden", undefined)).toBe("p-2");
  });
});

describe("withUsername", () => {
  it("returns the path unchanged when no username is given", () => {
    expect(withUsername("/123/rosters")).toBe("/123/rosters");
  });

  it("appends an encoded username query parameter", () => {
    expect(withUsername("/123/rosters", "tim blazing")).toBe("/123/rosters?username=tim%20blazing");
  });
});

describe("points", () => {
  it("recombines Sleeper's whole and hundredths parts", () => {
    expect(points(102, 45)).toBe(102.45);
  });

  it("treats missing parts as zero", () => {
    expect(points()).toBe(0);
    expect(points(7)).toBe(7);
  });
});
