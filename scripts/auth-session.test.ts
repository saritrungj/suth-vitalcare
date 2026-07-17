import assert from "node:assert/strict";
import {
  isValidStoredUser,
  readStoredUser,
  writeStoredUser,
} from "../src/store/authSession";

const store = new Map<string, string>();
const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
};

assert.equal(isValidStoredUser({ id: 1 }), true);
assert.equal(isValidStoredUser({ id: "abc" }), true);
assert.equal(isValidStoredUser({ id: "" }), false);
assert.equal(isValidStoredUser(null), false);

writeStoredUser({ id: 7, fname_th: "Test" }, storage);
assert.deepEqual(readStoredUser(storage), { id: 7, fname_th: "Test" });

store.set("vitalcare_user", "{bad json");
assert.equal(readStoredUser(storage), null);
assert.equal(store.has("vitalcare_user"), false);

store.set("vitalcare_user", JSON.stringify({ name: "missing id" }));
assert.equal(readStoredUser(storage), null);
assert.equal(store.has("vitalcare_user"), false);

writeStoredUser(null, storage);
assert.equal(store.has("vitalcare_user"), false);
