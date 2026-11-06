const operations: Record<string, (a: number, b: number) => number> = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b,
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
};

export class CalculationError extends Error {}

export function calculate(a: number, b: number, operation: string): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new CalculationError("a and b must be finite numbers");
  }

  const calculateOperation = operations[operation];
  if (!calculateOperation) {
    throw new CalculationError("Unsupported operation");
  }

  if ((operation === "divide" || operation === "/") && b === 0) {
    throw new CalculationError("Division by zero");
  }

  const result = calculateOperation(a, b);
  if (!Number.isFinite(result)) {
    throw new CalculationError("Calculation result is outside the supported range");
  }

  return result;
}
