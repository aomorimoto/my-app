import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskappTools } from "./tools";

// Delegaru の MCP サーバインスタンスを生成する。
// ステートレスな Streamable HTTP ではリクエストごとに new して使い捨てる（http.ts 参照）。
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "delegaru", version: "0.1.0" });
  registerTaskappTools(server);
  return server;
}
