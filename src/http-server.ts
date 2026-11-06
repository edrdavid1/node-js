import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

export const MAX_BODY_BYTES = 1024 * 1024;

export interface User {
  name: string;
  age: number;
}

class PayloadTooLargeError extends Error {}

export function validateUserPayload(value: unknown): User {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object");
  }

  const payload = value as Record<string, unknown>;

  if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
    throw new Error("name must be a non-empty string");
  }

  if (
    typeof payload.age !== "number" ||
    !Number.isSafeInteger(payload.age) ||
    payload.age < 0
  ) {
    throw new Error("age must be a non-negative integer");
  }

  return { name: payload.name, age: payload.age };
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: object,
  headers: Record<string, string> = {},
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let receivedBytes = 0;
    let settled = false;

    request.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.length;

      if (receivedBytes > MAX_BODY_BYTES) {
        settled = true;
        request.pause();
        reject(new PayloadTooLargeError());
        return;
      }

      chunks.push(buffer);
    });

    request.on("end", () => {
      if (!settled) {
        resolve(Buffer.concat(chunks));
      }
    });

    request.on("error", (error) => {
      if (!settled) {
        reject(error);
      }
    });
  });
}

async function handleUsersRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined && Number(contentLength) > MAX_BODY_BYTES) {
    sendJson(
      response,
      413,
      { error: "Payload Too Large" },
      { Connection: "close" },
    );
    return;
  }

  const contentType = request.headers["content-type"] ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    sendJson(response, 415, { error: "Content-Type must be application/json" });
    return;
  }

  let body: Buffer;
  try {
    body = await readRequestBody(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      sendJson(
        response,
        413,
        { error: "Payload Too Large" },
        { Connection: "close" },
      );
      return;
    }
    throw error;
  }

  let value: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    value = JSON.parse(text) as unknown;
  } catch {
    sendJson(response, 400, { error: "Request body must be valid JSON" });
    return;
  }

  try {
    const user = validateUserPayload(value);
    sendJson(response, 201, user);
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid user data",
    });
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  let pathname: string;
  let searchParams: URLSearchParams;

  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    pathname = requestUrl.pathname;
    searchParams = requestUrl.searchParams;
  } catch {
    sendJson(response, 400, { error: "Bad Request" });
    return;
  }

  if (pathname === "/search") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "GET" });
      return;
    }

    const query = searchParams.get("q");
    if (query === null || query.trim().length === 0) {
      sendJson(response, 400, {
        error: "Query parameter q is required and must not be empty",
      });
      return;
    }

    sendJson(response, 200, { q: query });
    return;
  }

  if (pathname === "/users") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "POST" });
      return;
    }

    await handleUsersRequest(request, response);
    return;
  }

  sendJson(response, 404, { error: "Not Found" });
}

export function createHttpServer(): Server {
  return createServer((request, response) => {
    void handleRequest(request, response).catch(() => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Internal Server Error" });
      } else {
        response.destroy();
      }
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  const server = createHttpServer();
  server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });
}
