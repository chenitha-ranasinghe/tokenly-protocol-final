/** Test double — real `p-retry` is used at runtime after `npm install`. */
export default async function pRetry<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}
