import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "@jest/globals";
import {
  exportCsvFiles,
  exportCsvToTxt,
  ExportStats,
} from "../../src/streams/export-csv-to-txt";

const assetsDirectory = path.resolve(__dirname, "../../src/assets");

afterAll(async () => {
  await exportCsvToTxt();
});

test("exports qualifying movies and writes the expected summary", async () => {
  const stats = await exportCsvToTxt();
  const output = await readFile(path.join(assetsDirectory, "movies.txt"), "utf8");
  const savedSummary = JSON.parse(
    await readFile(path.join(assetsDirectory, "summary.json"), "utf8"),
  ) as ExportStats;
  const records = output
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);

  expect(stats).toEqual({
    processed: 15,
    exported: 8,
    skipped: { invalid: 1, filtered: 6 },
    byDecade: { "2010s": 4, "1990s": 2, "2000s": 2 },
  });
  expect(savedSummary).toEqual(stats);
  expect(records).toHaveLength(8);
  expect(Object.keys(records[0])).toEqual([
    "movie",
    "director",
    "year",
    "rating",
    "decade",
    "length",
  ]);
  expect(records[0]).toEqual({
    movie: "Inception",
    director: "Christopher Nolan",
    year: 2010,
    rating: 8.8,
    decade: "2010s",
    length: "2h 28m",
  });
  expect(records.some((record) => "Duration" in record)).toBe(false);
});

test("handles quoted delimiters and custom filters", async () => {
  const stats = await exportCsvToTxt({ minYear: 0, minRating: 0 });
  const output = await readFile(path.join(assetsDirectory, "movies.txt"), "utf8");
  const records = output
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);

  expect(stats.processed).toBe(15);
  expect(stats.exported).toBe(14);
  expect(stats.skipped).toEqual({ invalid: 1, filtered: 0 });
  expect(records.find((record) => record.movie === "Crouching Tiger; Hidden Dragon"))
    .toMatchObject({ movie: "Crouching Tiger; Hidden Dragon", length: "2h 0m" });
});

test("rejects a missing input file without hanging", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "movies-export-"));

  try {
    await expect(
      exportCsvFiles(
        path.join(temporaryDirectory, "missing.csv"),
        path.join(temporaryDirectory, "movies.txt"),
        path.join(temporaryDirectory, "summary.json"),
      ),
    ).rejects.toThrow();
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
