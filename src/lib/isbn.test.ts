import { describe, expect, it } from "vitest";

import { isValidIsbn10, isValidIsbn13, isbn10To13, parseIsbn } from "./isbn";

describe("isbn", () => {
  it("accepts a valid ISBN-13 with hyphens and returns it canonical", () => {
    // Suske en Wiske 67, De Texasrakkers (Standaard Uitgeverij)
    expect(parseIsbn("978-90-02-25466-6")).toBe("9789002254666");
  });

  it("rejects an ISBN-13 with a wrong check digit", () => {
    expect(isValidIsbn13("9789002254667")).toBe(false);
    expect(parseIsbn("9789002254667")).toBeNull();
  });

  it("converts a valid ISBN-10 to ISBN-13", () => {
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isbn10To13("0306406152")).toBe("9780306406157");
    expect(parseIsbn("0-306-40615-2")).toBe("9780306406157");
  });

  it("handles the X check digit in ISBN-10", () => {
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(parseIsbn("080442957x")).toBe("9780804429573");
  });

  it("treats an empty string as no ISBN", () => {
    expect(parseIsbn("")).toBeNull();
    expect(parseIsbn("   ")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(parseIsbn("hello")).toBeNull();
    expect(parseIsbn("12345")).toBeNull();
  });
});
