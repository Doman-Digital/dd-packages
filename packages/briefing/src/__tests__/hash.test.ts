import { describe, expect, it } from "vitest";
import { sha256Hex } from "../hash";

describe("sha256Hex", () => {
  it("matches the FIPS 180-4 test vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("hashes UTF-8, across block boundaries", () => {
    expect(sha256Hex("£")).toBe("b4fe151e413445357b1c0935e7cf04a429492ebd23dc62bfadb2f898c431c1fd");
    expect(sha256Hex("a".repeat(55))).toHaveLength(64);
    expect(sha256Hex("a".repeat(56))).not.toBe(sha256Hex("a".repeat(55)));
  });

  it("agrees with Web Crypto", async () => {
    const text = "Approve the six sample pages. ".repeat(20);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
    expect(sha256Hex(text)).toBe(Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join(""));
  });
});
