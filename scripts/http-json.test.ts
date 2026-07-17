import assert from "node:assert/strict";
import { HttpError, parseJsonResponse } from "../src/lib/http";

const htmlResponse = new Response("<!DOCTYPE html><html>Error</html>", {
  status: 502,
  headers: { "content-type": "text/html; charset=utf-8" },
});

await assert.rejects(
  () => parseJsonResponse(htmlResponse),
  (error) =>
    error instanceof HttpError &&
    error.status === 502 &&
    error.message.includes("502") &&
    !error.message.includes("Unexpected token"),
);

const jsonResponse = new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { "content-type": "application/json" },
});
assert.deepEqual(await parseJsonResponse(jsonResponse), { ok: true });

const errorResponse = new Response(JSON.stringify({ error: "Bad login" }), {
  status: 400,
  headers: { "content-type": "application/json" },
});

await assert.rejects(
  () => parseJsonResponse(errorResponse),
  (error) =>
    error instanceof HttpError &&
    error.status === 400 &&
    error.message === "Bad login",
);
