import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.NODI_MODE = "public";
process.env.PUBLIC_DEMO_ENABLED = "false";
delete process.env.GROQ_API_KEY;

let base = "";
let close = () => {};
beforeAll(async () => {
  const { app } = await import("./index.ts");
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

describe("public prototype kill switch and missing key", () => {
  it("reports the missing key without revealing anything and shows a maintenance message when disabled", async () => {
    const health = (await (await fetch(`${base}/api/health`)).json()) as Record<string, unknown>;
    expect(health).toMatchObject({ mode: "public", aiConfigured: false, publicDemoEnabled: false });
    const session = await fetch(`${base}/api/session/demo`, { method: "POST" });
    expect(session.status).toBe(503);
    expect(((await session.json()) as { code: string }).code).toBe("demo_disabled");
  });
});
