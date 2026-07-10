import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, signupAgent, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("agents API / AI 担当者", () => {
  it("エージェント作成 → タスクの担当に設定 → 一覧で agent 絞り込みできる", async () => {
    const { agent, userId } = await signupAgent();

    const createdAgent = await agent.post("/api/agents").send({ name: "リサーチ担当" });
    expect(createdAgent.status).toBe(201);
    const agentId = createdAgent.body.agent.id;
    expect(createdAgent.body.agent.ownerId).toBe(userId);

    const task = await agent
      .post("/api/tasks")
      .send({ title: "調査タスク", assigneeAgentId: agentId });
    expect(task.status).toBe(201);
    expect(task.body.task.assigneeAgentId).toBe(agentId);
    expect(task.body.task.assigneeId).toBeNull();
    expect(task.body.task.assigneeAgent.name).toBe("リサーチ担当");

    const filtered = await agent.get(`/api/tasks?agent=${agentId}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.tasks).toHaveLength(1);
    expect(filtered.body.tasks[0].id).toBe(task.body.task.id);
  });

  it("担当者はユーザーとエージェントの両方指定で 400（相互排他）", async () => {
    const { agent, userId } = await signupAgent();
    const createdAgent = await agent.post("/api/agents").send({ name: "AI" });
    const agentId = createdAgent.body.agent.id;

    const res = await agent
      .post("/api/tasks")
      .send({ title: "両方", assigneeId: userId, assigneeAgentId: agentId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ASSIGNEE_CONFLICT");
  });

  it("エージェント担当のタスクにユーザーを割り当てるとエージェントは外れる", async () => {
    const { agent, userId } = await signupAgent();
    const createdAgent = await agent.post("/api/agents").send({ name: "AI" });
    const agentId = createdAgent.body.agent.id;

    const task = await agent
      .post("/api/tasks")
      .send({ title: "切替", assigneeAgentId: agentId });
    const id = task.body.task.id;

    const patched = await agent.patch(`/api/tasks/${id}`).send({ assigneeId: userId });
    expect(patched.status).toBe(200);
    expect(patched.body.task.assigneeId).toBe(userId);
    expect(patched.body.task.assigneeAgentId).toBeNull();
  });

  it("他ワークスペースのエージェントは担当に指定できない（400）", async () => {
    const a = await signupAgent({ username: "wsa" });
    const b = await signupAgent({ username: "wsb" });

    const bAgent = await b.agent.post("/api/agents").send({ name: "B の AI" });
    const bAgentId = bAgent.body.agent.id;

    // A が B のエージェントIDを指定 → A の WS には存在しないので 400
    const res = await a.agent
      .post("/api/tasks")
      .send({ title: "越境", assigneeAgentId: bAgentId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_AGENT");
  });
});
