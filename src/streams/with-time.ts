import { EventEmitter } from "node:events";

export type NodeCallback<TResult = unknown> = (
  error: Error | null,
  result?: TResult,
) => void;

export type CallbackAsyncFunction<TArgs extends unknown[]> = (
  ...args: [...TArgs, NodeCallback]
) => void;

let executionNumber = 0;

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class WithTime extends EventEmitter {
  execute<TArgs extends unknown[]>(
    asyncFunc: CallbackAsyncFunction<TArgs>,
    ...args: TArgs
  ): void {
    const timerLabel = `WithTime-${++executionNumber}`;
    this.emit("begin");
    console.time(timerLabel);

    let completed = false;
    const complete = (error: unknown, result?: unknown): void => {
      if (completed) {
        return;
      }
      completed = true;

      try {
        if (error) {
          this.emit("error", normalizeError(error));
        } else if (result !== undefined) {
          this.emit("data", result);
        }
      } finally {
        try {
          console.timeEnd(timerLabel);
        } finally {
          this.emit("end");
        }
      }
    };

    try {
      asyncFunc(...args, (error, result) => complete(error, result));
    } catch (error) {
      complete(error);
    }
  }
}
