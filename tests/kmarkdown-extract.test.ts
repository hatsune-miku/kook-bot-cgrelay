import { removingKMarkdownLabels } from "../src/utils/kevent/utils";

test("kmarkdown extract works", () => {
  expect(
    removingKMarkdownLabels("(met)123(met) (rol)role(rol) content", [
      "met",
      "rol"
    ])
  ).toBe("content");
});
