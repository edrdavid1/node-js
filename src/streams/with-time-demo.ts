import { NodeCallback, WithTime } from "./with-time";

const POST_URL = "https://jsonplaceholder.typicode.com/posts/1";

function fetchPost(callback: NodeCallback<unknown>): void {
  void fetch(POST_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP request failed with status ${response.status}`);
      }
      return response.json() as Promise<unknown>;
    })
    .then((post) => callback(null, post))
    .catch((error: unknown) => {
      callback(error instanceof Error ? error : new Error(String(error)));
    });
}

if (require.main === module) {
  const timedRequest = new WithTime();
  timedRequest.on("begin", () => console.log("Request started"));
  timedRequest.on("data", (post: unknown) => console.log("Response:", post));
  timedRequest.on("error", (error: Error) => console.error("Request failed:", error.message));
  timedRequest.on("end", () => console.log("Request finished"));
  timedRequest.execute(fetchPost);
}
