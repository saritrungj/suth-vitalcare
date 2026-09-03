import assert from "node:assert/strict";
import { getClientIp, normalizeClientIp } from "../server/lib/clientIp";

assert.equal(normalizeClientIp("203.0.113.8:54321"), "203.0.113.8");
assert.equal(
  normalizeClientIp("[2001:db8::1234]:443"),
  "2001:db8::1234",
);
assert.equal(normalizeClientIp("::ffff:192.0.2.4"), "192.0.2.4");
assert.equal(normalizeClientIp("2001:db8::1234"), "2001:db8::1234");

const request = {
  headers: {
    "cf-connecting-ip": "2001:db8::1",
    "x-forwarded-for": "198.51.100.2, 172.68.1.2:12345",
  },
  ip: "127.0.0.1",
  socket: { remoteAddress: "127.0.0.1" },
} as any;
assert.equal(getClientIp(request), "2001:db8::1");

delete request.headers["cf-connecting-ip"];
assert.equal(getClientIp(request), "198.51.100.2");

console.log("client-ip tests passed");
