import { AddressInfo } from "node:net";
import { Server } from "node:http";
import { afterAll, beforeAll, expect, test } from "@jest/globals";
import { createApp } from "../../src/express-1/app";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
});

test("GET /calculate returns the arithmetic result", async () => {
  const response = await fetch(
    `${baseUrl}/calculate?a=10&b=5&operation=multiply`,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ result: 50 });
});

test("accepts encoded arithmetic symbols as operations", async () => {
  const response = await fetch(
    `${baseUrl}/calculate?a=10&b=5&operation=%2B`,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ result: 15 });
});

test("returns JSON errors for invalid input and division by zero", async () => {
  const missingParameter = await fetch(`${baseUrl}/calculate?a=10&operation=add`);
  expect(missingParameter.status).toBe(400);
  await expect(missingParameter.json()).resolves.toHaveProperty("error");

  const invalidOperation = await fetch(
    `${baseUrl}/calculate?a=10&b=5&operation=power`,
  );
  expect(invalidOperation.status).toBe(400);
  await expect(invalidOperation.json()).resolves.toEqual({
    error: "Unsupported operation",
  });

  const divisionByZero = await fetch(
    `${baseUrl}/calculate?a=10&b=0&operation=divide`,
  );
  expect(divisionByZero.status).toBe(400);
  await expect(divisionByZero.json()).resolves.toEqual({
    error: "Division by zero",
  });
});

test("returns 405 for unsupported methods and 404 for other paths", async () => {
  const wrongMethod = await fetch(`${baseUrl}/calculate?a=10&b=5&operation=add`, {
    method: "POST",
  });
  expect(wrongMethod.status).toBe(405);
  expect(wrongMethod.headers.get("allow")).toBe("GET");

  const wrongPath = await fetch(`${baseUrl}/missing`);
  expect(wrongPath.status).toBe(404);
  await expect(wrongPath.json()).resolves.toEqual({ error: "Not Found" });
});
