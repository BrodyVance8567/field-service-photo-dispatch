import assert from "node:assert/strict";
import test from "node:test";
import { decideDispatch } from "../src/dispatch_decision.js";

test("holds dispatch when the photo indicates specialist follow-up", () => {
  const decision = decideDispatch("WO-1842", {
    summary: "The electrical cabinet shows heat discoloration.",
    siteSafe: false,
    specialistRequired: true,
    technicianFollowUp: "Call the customer and assign a licensed electrician.",
  });

  assert.equal(decision.dispatchStatus, "technician_follow_up");
  assert.equal(
    decision.technicianFollowUp,
    "Call the customer and assign a licensed electrician.",
  );
});
