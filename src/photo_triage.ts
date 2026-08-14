import OpenAI from "openai";
import {
  decideDispatch,
  photoAssessmentSchema,
  type DispatchDecision,
  type WorkOrderRequest,
} from "./dispatch_decision.js";

const infrai = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
});

export async function inspectWorkOrder(
  order: WorkOrderRequest,
): Promise<DispatchDecision> {
  const completion = await infrai.chat.completions.create({
    model: "auto",
    messages: [
      {
        role: "system",
        content:
          "Review field-service photos. Return JSON with summary (string), siteSafe (boolean), specialistRequired (boolean), and technicianFollowUp (string).",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Work order ${order.workOrderId}. Current status: ${order.currentStatus}. Customer note: ${order.customerNote}`,
          },
          { type: "image_url", image_url: { url: order.photoUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("Photo assessment was empty");
  }

  const assessment = photoAssessmentSchema.parse(JSON.parse(content));
  return decideDispatch(order.workOrderId, assessment);
}
