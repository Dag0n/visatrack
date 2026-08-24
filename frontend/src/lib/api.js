import { pb } from "./pb";

const base = pb.baseURL.replace(/\/$/, "");

// Fetch a /api/custom/* endpoint and parse the JSON response. Pass an
// AbortSignal to cancel on unmount; aborted requests reject with an
// AbortError (name === "AbortError"), which callers should ignore.
export function fetchCustom(path, { signal } = {}) {
  return fetch(`${base}/api/custom${path}`, { signal }).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${path}`);
    return res.json();
  });
}

export function isAbortError(err) {
  return err?.name === "AbortError";
}
