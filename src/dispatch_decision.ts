import { z } from "zod";

export const workOrderRequestSchema = z.object({
  workOrderId: z.string().min(1),
  photoUrl: z.string().url(),
  customerNote: z.string().min(1).max(1000),
  currentStatus: z.enum(["awaiting_review", "dispatched", "technician_follow_up"]),
});

export type WorkOrderRequest = z.infer<typeof workOrderRequestSchema>;

export const photoAssessmentSchema = z.object({
  summary: z.string().min(1),
  siteSafe: z.boolean(),
  specialistRequired: z.boolean(),
  technicianFollowUp: z.string().min(1),
});

export type PhotoAssessment = z.infer<typeof photoAssessmentSchema>;

export type DispatchDecision = PhotoAssessment & {
  workOrderId: string;
  dispatchStatus: "ready_to_dispatch" | "technician_follow_up";
};

export function decideDispatch(
  workOrderId: string,
  assessment: PhotoAssessment,
): DispatchDecision {
  const dispatchStatus =
    assessment.siteSafe && !assessment.specialistRequired
      ? "ready_to_dispatch"
      : "technician_follow_up";

  return { workOrderId, dispatchStatus, ...assessment };
}
