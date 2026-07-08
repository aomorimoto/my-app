import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app, closeDb } from "./helpers";

afterAll(closeDb);

describe("health", () => {
  it("GET /api/health は 200 で status=ok / db=up（認証不要）", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("up");
    expect(typeof res.body.uptime).toBe("number");
  });
});
