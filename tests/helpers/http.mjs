export const BASE_URL = process.env.BASE_URL_TEST || "http://localhost:9002";

export function parseSetCookie(headers) {
  const raw = headers.get("set-cookie");
  if (!raw) return "";
  return raw.split(",").map((part) => part.split(";")[0].trim()).join("; ");
}

export async function jsonRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

export async function login(username, password) {
  const { res, body } = await jsonRequest("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return {
    status: res.status,
    body,
    cookie: parseSetCookie(res.headers),
  };
}

