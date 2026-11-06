import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform, TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import csv = require("csvtojson");

export interface ExportOptions {
  minYear?: number;
  minRating?: number;
}

export interface ExportStats {
  processed: number;
  exported: number;
  skipped: {
    invalid: number;
    filtered: number;
  };
  byDecade: Record<string, number>;
}

interface CsvMovie {
  Movie?: string;
  Director?: string;
  Year?: string | number;
  Duration?: string | number;
  Rating?: string | number;
}

interface ExportedMovie {
  movie: string;
  director: string;
  year: number;
  rating: number;
  decade: string;
  length: string;
}

function parseNumber(value: unknown, decimalComma = false): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const text = String(value).trim();
  if (!text) {
    return undefined;
  }

  const normalized = decimalComma ? text.replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatLength(totalMinutes: number): string {
  const minutes = Math.floor(totalMinutes);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

class MovieTransform extends Transform {
  private remainder = "";

  constructor(
    private readonly stats: ExportStats,
    private readonly options: Required<ExportOptions>,
  ) {
    super();
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    const lines = `${this.remainder}${chunk.toString("utf8")}`.split(/\r?\n/);
    this.remainder = lines.pop() ?? "";

    try {
      for (const line of lines) {
        this.processLine(line);
      }
      callback();
    } catch (error) {
      callback(normalizeError(error));
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      if (this.remainder.trim()) {
        this.processLine(this.remainder);
      }
      callback();
    } catch (error) {
      callback(normalizeError(error));
    }
  }

  private processLine(line: string): void {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      return;
    }

    const row = JSON.parse(normalizedLine) as CsvMovie;
    this.stats.processed += 1;

    const movie = typeof row.Movie === "string" ? row.Movie.trim() : "";
    const director = typeof row.Director === "string" ? row.Director.trim() : "";
    const year = parseNumber(row.Year);
    const rating = parseNumber(row.Rating, true);
    const duration = parseNumber(row.Duration);

    if (
      !movie ||
      !director ||
      year === undefined ||
      rating === undefined ||
      duration === undefined ||
      duration < 0
    ) {
      this.stats.skipped.invalid += 1;
      return;
    }

    if (year < this.options.minYear || rating < this.options.minRating) {
      this.stats.skipped.filtered += 1;
      return;
    }

    const decade = `${Math.floor(year / 10) * 10}s`;
    const exportedMovie: ExportedMovie = {
      movie,
      director,
      year,
      rating,
      decade,
      length: formatLength(duration),
    };

    this.stats.exported += 1;
    this.stats.byDecade[decade] = (this.stats.byDecade[decade] ?? 0) + 1;
    this.push(`${JSON.stringify(exportedMovie)}\n`);
  }
}

export async function exportCsvToTxt(
  { minYear = 1995, minRating = 8.5 }: ExportOptions = {},
): Promise<ExportStats> {
  const assetsDirectory = path.resolve(__dirname, "../assets");
  return exportCsvFiles(
    path.join(assetsDirectory, "movies.csv"),
    path.join(assetsDirectory, "movies.txt"),
    path.join(assetsDirectory, "summary.json"),
    { minYear, minRating },
  );
}

export async function exportCsvFiles(
  inputPath: string,
  outputPath: string,
  summaryPath: string,
  { minYear = 1995, minRating = 8.5 }: ExportOptions = {},
): Promise<ExportStats> {
  const stats: ExportStats = {
    processed: 0,
    exported: 0,
    skipped: { invalid: 0, filtered: 0 },
    byDecade: {},
  };
  const options = { minYear, minRating };

  await Promise.all([
    mkdir(path.dirname(outputPath), { recursive: true }),
    mkdir(path.dirname(summaryPath), { recursive: true }),
  ]);

  const parser = csv(
    {
      delimiter: ";",
      output: "json",
      downstreamFormat: "line",
      checkType: false,
      checkColumn: true,
      needEmitAll: false,
    },
  );

  await pipeline(
    createReadStream(inputPath),
    parser,
    new MovieTransform(stats, options),
    createWriteStream(outputPath),
  );

  await writeFile(summaryPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
  return stats;
}

if (require.main === module) {
  void exportCsvToTxt()
    .then((stats) => console.log(JSON.stringify(stats, null, 2)))
    .catch((error: unknown) => {
      console.error("CSV export failed:", error);
      process.exitCode = 1;
    });
}
