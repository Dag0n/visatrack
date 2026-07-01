export function stripRedditPrefix(value) {
  return (value || "").trim().replace(/^\/?u\//i, "");
}

export function formatRedditUsername(value) {
  const clean = stripRedditPrefix(value);
  return clean ? `u/${clean}` : "Anon";
}
