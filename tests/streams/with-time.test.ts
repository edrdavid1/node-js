import { afterEach, expect, jest, test } from "@jest/globals";
import { NodeCallback, WithTime } from "../../src/streams/with-time";

afterEach(() => {
  jest.restoreAllMocks();
});

test("emits begin, data, and end in order and measures execution", async () => {
  jest.spyOn(console, "time").mockImplementation(() => undefined);
  const timeEnd = jest.spyOn(console, "timeEnd").mockImplementation(() => undefined);
  const timer = new WithTime();
  const events: unknown[] = [];
  timer.on("begin", () => events.push("begin"));
  timer.on("data", (value: unknown) => events.push(value));
  timer.on("end", () => events.push("end"));

  const completed = new Promise<void>((resolve) => timer.once("end", resolve));
  timer.execute(
    (value: string, callback: NodeCallback<string>) => {
      setImmediate(() => callback(null, value));
    },
    "result",
  );
  await completed;

  expect(events).toEqual(["begin", "result", "end"]);
  expect(timeEnd).toHaveBeenCalledTimes(1);
});

test("emits an error and always ends after callback failure", () => {
  jest.spyOn(console, "time").mockImplementation(() => undefined);
  jest.spyOn(console, "timeEnd").mockImplementation(() => undefined);
  const timer = new WithTime();
  const expectedError = new Error("request failed");
  const events: unknown[] = [];
  timer.on("begin", () => events.push("begin"));
  timer.on("error", (error: Error) => events.push(error));
  timer.on("end", () => events.push("end"));

  timer.execute((callback: NodeCallback) => callback(expectedError));

  expect(events).toEqual(["begin", expectedError, "end"]);
});

test("handles a synchronous throw and ends only once", () => {
  jest.spyOn(console, "time").mockImplementation(() => undefined);
  jest.spyOn(console, "timeEnd").mockImplementation(() => undefined);
  const timer = new WithTime();
  const expectedError = new Error("synchronous failure");
  const errors: Error[] = [];
  const end = jest.fn();
  timer.on("error", (error: Error) => errors.push(error));
  timer.on("end", end);

  timer.execute((_callback: NodeCallback) => {
    throw expectedError;
  });

  expect(errors).toEqual([expectedError]);
  expect(end).toHaveBeenCalledTimes(1);
});
