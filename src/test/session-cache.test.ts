import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { syncSessionCache } from "@/lib/session-cache";

describe("session cache isolation", () => {
  it("removes private documents and vote state on sign-out without refetching", () => {
    const client = new QueryClient();
    client.setQueryData(["vault"], [{ title: "Private script" }]);
    client.setQueryData(["posts"], [{ mine: true }]);
    client.setQueryData(["roles"], ["admin"]);
    syncSessionCache(client, null);
    expect(client.getQueryData(["vault"])).toBeUndefined();
    expect(client.getQueryData(["posts"])).toBeUndefined();
    expect(client.getQueryData(["roles"])).toBeUndefined();
    expect(client.getQueryData(["session"])).toBeNull();
  });
});