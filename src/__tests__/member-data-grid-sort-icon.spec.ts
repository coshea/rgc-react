import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("global DataGrid styles", () => {
  it("imports the HeroUI DataGrid stylesheet for descending-sort chevrons", () => {
    const globalsCss = readFileSync(
      resolve(process.cwd(), "src/styles/globals.css"),
      "utf8",
    );

    expect(globalsCss).toContain(
      '@import "@heroui-pro/react/css/components/data-grid.css";',
    );
  });
});
