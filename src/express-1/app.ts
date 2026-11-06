import express, { Express, Request, Response } from "express";
import { calculate } from "./calculator";

function parseQueryNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}



export function createApp(): Express {
    console.log("Creating Express app");
  const app = express();



  app.get("/calculate", (request: Request, response: Response) => {
    console.log(`Received request: ${request.method} ${request.path}?${request.url.split("?")[1]}`);
    const a = parseQueryNumber(request.query.a);
    const b = parseQueryNumber(request.query.b);
    const operation = request.query.operation;

    if (a === undefined || b === undefined) {
      response.status(400).json({ error: "Query parameters a and b must be numbers" });
      console.error("Query parameters a and b must be numbers");
      return;
    }

    if (typeof operation !== "string" || operation.trim() === "") {
      response.status(400).json({ error: "Query parameter operation is required" });
      console.error("Query parameter operation is required");
      return;
    }

    try {
      response.status(200).json({ result: calculate(a, b, operation) });
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Invalid calculation",
      });
    }
  });

  app.all("/calculate", (_request: Request, response: Response) => {
    response
      .set("Allow", "GET")
      .status(405)
      .json({ error: "Method Not Allowed" });
  });

  app.use((_request: Request, response: Response) => {
    response.status(404).json({ error: "Not Found" });
    console.error(`Path ${_request.path} not found`);
  });

  return app;
}
