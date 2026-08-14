import { createServer } from "node:http";
import { ZodError } from "zod";
import OpenAI from "openai";
import { workOrderRequestSchema } from "./dispatch_decision.js";
import { inspectWorkOrder } from "./photo_triage.js";

const port = Number(process.env.PORT ?? 3000);

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");

  if (request.method !== "POST" || request.url !== "/work-orders/inspect") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  try {
    const order = workOrderRequestSchema.parse(await readJson(request));
    const decision = await inspectWorkOrder(order);
    response.writeHead(200).end(JSON.stringify(decision));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid request body" }));
      return;
    }
    if (error instanceof OpenAI.APIError && error.status && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.message }));
      return;
    }
    console.error(error);
    response.writeHead(502).end(JSON.stringify({ error: "Photo assessment failed" }));
  }
});

server.listen(port, () => {
  console.log(`Work-order inspection listening on http://localhost:${port}`);
});
