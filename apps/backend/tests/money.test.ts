import { describe, expect, it } from "vitest";
import { toJsonValue, toMinorUnits } from "../src/money.js";

describe("money conversion", () => {
  it("stores naira values as integer kobo", () => {
    expect(toMinorUnits(12.34)).toBe(1234n);
    expect(toMinorUnits("0.005")).toBe(1n);
  });

  it("rejects invalid values", () => {
    expect(() => toMinorUnits("not-money")).toThrow();
  });

  it("serializes bigint API fields safely", () => {
    expect(toJsonValue({ totalMinor: 1250n })).toEqual({ totalMinor: "1250" });
  });
});
