import { expect, test } from "@jest/globals";
import { calculate, CalculationError } from "../../src/express-1/calculator";

const validOperations: Array<[string, number]> = [
  ["add", 7],
  ["+", 7],
  ["subtract", 3],
  ["-", 3],
  ["multiply", 10],
  ["*", 10],
  ["divide", 2.5],
  ["/", 2.5],
];

for (const [operation, expected] of validOperations) {
  test(`calculates operation ${operation}`, () => {
    expect(calculate(5, 2, operation)).toBe(expected);
  });
}

test("rejects division by zero", () => {
  expect(() => calculate(5, 0, "divide")).toThrow("Division by zero");
  expect(() => calculate(5, 0, "/")).toThrow(CalculationError);
});

test("rejects unknown operations and non-finite values", () => {
  expect(() => calculate(1, 2, "power")).toThrow("Unsupported operation");
  expect(() => calculate(Number.NaN, 2, "add")).toThrow("finite numbers");
});
