import { it, expect } from "vitest";
import { renderKnowledgeMarkdown } from "@/lib/knowledgeExport/renderKnowledgeMarkdown";

it("renders one self-contained file with the citations resolved at the end", () => {
  expect(
    renderKnowledgeMarkdown({
      name: "Bio Ritmo",
      content: "  Bio Ritmo is a salsa band from Richmond [1]. They talk about it [2].\n",
      sources: [
        {
          id: 1,
          kind: "vault",
          label: "About · bioritmo.com",
          url: "https://www.bioritmo.com/about",
          publishedAt: "2024-05-01T00:00:00Z",
        },
        { id: 2, kind: "interview", label: "Interview answer", url: null },
      ],
      header: "> Verified profile compiled by Music Nerd from 2 sources, exported 2026-10-21.",
    }),
  ).toBe(
    [
      "# Bio Ritmo",
      "",
      "> Verified profile compiled by Music Nerd from 2 sources, exported 2026-10-21.",
      "> Bracketed numbers in the text refer to the numbered sources at the end.",
      "",
      "Bio Ritmo is a salsa band from Richmond [1]. They talk about it [2].",
      "",
      "## Sources",
      "",
      "1. About · bioritmo.com (2024-05-01) — https://www.bioritmo.com/about",
      "2. Interview answer",
    ].join("\n"),
  );
});
