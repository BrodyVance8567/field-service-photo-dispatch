import { inspectWorkOrder } from "../src/photo_triage.js";
import { workOrderRequestSchema } from "../src/dispatch_decision.js";

const order = workOrderRequestSchema.parse({
  workOrderId: "WO-1842",
  photoUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  customerNote: "The outdoor unit hums, but the fan does not turn.",
  currentStatus: "awaiting_review",
});

console.log(await inspectWorkOrder(order));
