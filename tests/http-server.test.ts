import { expect, test } from "@jest/globals";
import { validateUserPayload } from "../src/http-server";

test("accepts a user and ignores extra properties", () => {
  expect(
    validateUserPayload({ name: "Anna", age: 25, role: "admin" }),
  ).toEqual({ name: "Anna", age: 25 });
});

test("rejects non-object JSON roots", () => {
  for (const value of [null, [], "Anna", 25]) {
    expect(() => validateUserPayload(value)).toThrow();
  }
});

test("rejects empty names and invalid ages", () => {
  const invalidUsers = [
    { name: "   ", age: 25 },
    { name: "Anna", age: -1 },
    { name: "Anna", age: 25.5 },
    { name: "Anna", age: "25" },
  ];

  for (const value of invalidUsers) {
    expect(() => validateUserPayload(value)).toThrow();
  }
});
