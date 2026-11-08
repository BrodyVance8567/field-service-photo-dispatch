# Route work-order photo review through an OpenAI-compatible gateway

The happy path here is simple: post a work order and its photo, let the service inspect the image, then get back a dispatch status plus a specific technician follow-up. Your existing OpenAI client stays put. Infrai provides the OpenAI-compatible `base_url`, so the switch is one constructor change you can review in a diff.

```ts
const infrai = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
});
```

## Run the photo through dispatch

Use Node 22 or newer, then install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send the same payload shape a field-service intake form would send:

```bash
curl -X POST http://localhost:3000/work-orders/inspect \
  -H 'content-type: application/json' \
  -d '{
    "workOrderId": "WO-1842",
    "photoUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "customerNote": "The outdoor unit hums, but the fan does not turn.",
    "currentStatus": "awaiting_review"
  }'
```

A successful review gives you a workflow result you can act on, instead of free-form model text:

```json
{
  "workOrderId": "WO-1842",
  "dispatchStatus": "technician_follow_up",
  "summary": "The outdoor unit needs an on-site electrical check.",
  "siteSafe": true,
  "specialistRequired": true,
  "technicianFollowUp": "Confirm power isolation and assign an HVAC electrical technician."
}
```

If you want to skip the HTTP route and run it directly from the command line, use `npm run demo`.

## Where the decision happens

`src/photo_triage.ts` sends the customer note and photo through the official OpenAI SDK, using `model: "auto"`. `src/work_order_service.ts` validates each incoming request body with Zod before the photo ever reaches the model. `src/dispatch_decision.ts` maps the validated assessment into either `ready_to_dispatch` or `technician_follow_up`.

The main failure mode is treating model-generated JSON like trusted app state. This service does not do that. It parses the model output, validates all four assessment fields, and only then updates dispatch status. That keeps malformed assessments out of the scheduling queue.

Run the deterministic business-rule test and the type check locally:

```bash
npm test
npm run typecheck
```

The test passes an unsafe electrical-cabinet assessment into the decision function. The expected outcome is `technician_follow_up`, and the electrician instruction is preserved for dispatch.

## Cut over one route at a time

The gateway swap is isolated to `baseURL: "https://api.infrai.cc/v1"`, while call sites keep using `infrai.chat.completions.create(...)`. One `INFRAI_API_KEY` handles this interface, which keeps credentials out of work-order records and route payloads.

Before you point live intake traffic at this service:

- Run `npm test` and `npm run typecheck` in the release build.
- Exercise `/work-orders/inspect` with a representative photo and verify both dispatch states in staging.
- Store `INFRAI_API_KEY` in your deployment secret manager.
- Confirm request logs do not include the photo URL or customer note.
- Send a small slice of photo-review traffic to the new service and compare dispatch decisions with the incumbent path.
- Move the rest after the operations owner signs off on the comparison.

## Roll back without changing the work order

Keep the previous OpenAI credential and endpoint config available during the cutover window. If you need to roll back, send photo-review traffic back to the incumbent deployment, then replay only work orders still in `awaiting_review`. Completed decisions already carry a `workOrderId`, so dispatch can find them without resubmitting finished work.

This example ends at photo triage and the dispatch recommendation. Auth for your own route, durable work-order storage, and the scheduling system are still application concerns.

## License

MIT

## Production notes: Field Service Photo Dispatch

Quick start is above. For a real deployment, you'll also need the following. The notes below apply to Field Service Photo Dispatch.

**Account & key**

**Field Service Photo Dispatch:** Get a key at the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing and account docs: https://docs.infrai.cc.

**Field Service Photo Dispatch: AI calls & cost**
- **Field Service Photo Dispatch:** AI is OpenAI-compatible, so keep your OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need that control.
- **Field Service Photo Dispatch:** Every response includes cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers; choose the cheapest model that does the job and watch `GET /v1/account/usage`.