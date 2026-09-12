import { expect, it } from "vitest";

import { slugify } from "./slug";

it("slugifies titles with punctuation and diacritics", () => {
  expect(slugify("Suske en Wiske: De Texasrakkers")).toBe("suske-en-wiske-de-texasrakkers");
  expect(slugify("Blake & Mortimer")).toBe("blake-mortimer");
  expect(slugify("  Astérix chez les Belges! ")).toBe("asterix-chez-les-belges");
});
