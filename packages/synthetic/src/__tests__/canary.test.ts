import { describe, expect, it } from "vitest";
import { SyntheticRecipientError, assertCanaryRecipient, canaryAddress, isCanaryRecipient } from "../index";

describe("recipient lock", () => {
  it.each([
    "s-abcdefghijklmnop@canary.domandigital.co.uk",
    "u-abcdefghijklmnop@CANARY.domandigital.co.uk",
    "a.b+c@canary.domandigital.co.uk",
  ])("allows %s", (email) => {
    expect(isCanaryRecipient(email)).toBe(true);
    expect(() => assertCanaryRecipient(email)).not.toThrow();
  });

  it.each([
    "customer@gmail.com",
    "x@domandigital.co.uk",
    "x@evil.canary.domandigital.co.uk",
    "x@canary.domandigital.co.uk.evil.com",
    "x@canary.domandigital.co.uk.",
    "x@notcanary.domandigital.co.uk",
    "x@canary-domandigital.co.uk",
    "a@canary.domandigital.co.uk, b@gmail.com",
    "a@canary.domandigital.co.uk\nbcc: b@gmail.com",
    "Name <a@canary.domandigital.co.uk>",
    "a@b@canary.domandigital.co.uk",
    "@canary.domandigital.co.uk",
    "",
    42,
    null,
    undefined,
    ["a@canary.domandigital.co.uk"],
  ])("refuses %j", (email) => {
    expect(isCanaryRecipient(email)).toBe(false);
    expect(() => assertCanaryRecipient(email)).toThrow(SyntheticRecipientError);
  });

  it("refuses the whole set if one address is real", () => {
    expect(() => assertCanaryRecipient("s-abcdefghijklmnop@canary.domandigital.co.uk", "ceo@client.com")).toThrow(SyntheticRecipientError);
  });
});

describe("canaryAddress", () => {
  it("builds s- and u- addresses from a run id, and they pass the lock", () => {
    expect(canaryAddress("s", "abcdefghijklmnop")).toBe("s-abcdefghijklmnop@canary.domandigital.co.uk");
    expect(isCanaryRecipient(canaryAddress("u", "abcdefghijklmnop"))).toBe(true);
    expect(() => canaryAddress("s", "bad")).toThrow();
  });
});
