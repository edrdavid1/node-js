import { AddressInfo } from "node:net";
import * as http from "node:http";
import { afterAll, beforeAll, expect, test } from "@jest/globals";
import { createHttpServer, MAX_BODY_BYTES } from "../src/http-server";

let server: http.Server;
let port: number;

interface TestResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}

function sendRequest(
  method: string,
  route: string,
  body?: string,
  headers: http.OutgoingHttpHeaders = {},
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: "127.0.0.1", port, method, path: route, headers },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          let parsedBody: unknown;
          try {
            parsedBody = JSON.parse(responseBody) as unknown;
          } catch {
            parsedBody = responseBody;
          }
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: parsedBody,
          });
        });
      },
    );

    request.on("error", reject);
    if (body !== undefined) {
      request.write(body);
    }
    request.end();
  });
}

beforeAll(async () => {
  server = createHttpServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
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

test("GET /search returns the query parameter", async () => {
  const response = await sendRequest("GET", "/search?q=node");

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({ q: "node" });
});

test("GET /search validates q, path, and method", async () => {
  const missingQuery = await sendRequest("GET", "/search");
  expect(missingQuery.statusCode).toBe(400);
  expect(typeof (missingQuery.body as { error: unknown }).error).toBe("string");

  const emptyQuery = await sendRequest("GET", "/search?q=");
  expect(emptyQuery.statusCode).toBe(400);

  const whitespaceQuery = await sendRequest("GET", "/search?q=%20%20");
  expect(whitespaceQuery.statusCode).toBe(400);

  const wrongMethod = await sendRequest("POST", "/search");
  expect(wrongMethod.statusCode).toBe(405);
  expect(wrongMethod.headers.allow).toBe("GET");

  const wrongPath = await sendRequest("GET", "/missing");
  expect(wrongPath.statusCode).toBe(404);
  expect(wrongPath.body).toEqual({ error: "Not Found" });

  const wrongUsersMethod = await sendRequest("GET", "/users");
  expect(wrongUsersMethod.statusCode).toBe(405);
  expect(wrongUsersMethod.headers.allow).toBe("POST");
});

test("POST /users creates a user and omits extra properties", async () => {
  const response = await sendRequest(
    "POST",
    "/users",
    JSON.stringify({ name: "Anna", age: 25, isAdmin: true }),
    { "Content-Type": "application/json" },
  );

  expect(response.statusCode).toBe(201);
  expect(response.body).toEqual({ name: "Anna", age: 25 });
});

test("POST /users reports malformed JSON, invalid roots, and content types", async () => {
  const malformedJson = await sendRequest("POST", "/users", "{", {
    "Content-Type": "application/json",
  });
  expect(malformedJson.statusCode).toBe(400);

  const invalidRoot = await sendRequest("POST", "/users", "null", {
    "Content-Type": "application/json",
  });
  expect(invalidRoot.statusCode).toBe(400);

  const unsupportedType = await sendRequest("POST", "/users", "{}", {
    "Content-Type": "text/plain",
  });
  expect(unsupportedType.statusCode).toBe(415);
});

test("POST /users rejects an oversized Content-Length before reading a body", async () => {
  const response = await sendRequest("POST", "/users", undefined, {
    "Content-Type": "application/json",
    "Content-Length": String(MAX_BODY_BYTES + 1),
  });

  expect(response.statusCode).toBe(413);
  expect(response.body).toEqual({ error: "Payload Too Large" });
});

test("POST /users also rejects oversized streamed bodies", async () => {
  const response = await sendRequest(
    "POST",
    "/users",
    " ".repeat(MAX_BODY_BYTES + 1),
    { "Content-Type": "application/json" },
  );

  expect(response.statusCode).toBe(413);
  expect(response.body).toEqual({ error: "Payload Too Large" });
});
