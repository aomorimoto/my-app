import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";

// ステートレスな Streamable HTTP の /mcp（POST）ハンドラ。
// リクエストごとに MCP サーバ + トランスポートを生成して使い捨てる。
// セッションをメモリに持たないので、Render の再起動・複数インスタンスでも安全。
export async function handleMcpPost(req: Request, res: Response) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // ステートレス（セッションIDを発行しない）
    enableJsonResponse: true, // SSE ではなく素の JSON レスポンス
  });

  // 応答が閉じたら後片付け（リーク防止）。
  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  // requireBearerAuth が載せた req.auth をトランスポートが authInfo として引き継ぎ、
  // 各ツールの extra.authInfo から userId/token を参照できる。
  // express.json() 済みなのでパース済みボディを第3引数で渡す。
  await transport.handleRequest(req, res, req.body);
}

// ステートレスでは GET(SSE ストリーム)/DELETE(セッション終了) は扱わない。
export function methodNotAllowed(_req: Request, res: Response) {
  res
    .status(405)
    .json({ error: { message: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" } });
}
