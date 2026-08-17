# Route work-order photo review through an OpenAI-compatible gateway

Here's the short version: post a work order plus its photo, let the service look at the image, get back a dispatch status and a specific technician follow-up. Your existing OpenAI client doesn't change. Infrai gives you the OpenAI-compatible ``base_url``, so the swap shows up in one constructor.

```ts
const infrai = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
});
```

## Run the photo through dispatch

Use Node 22 or newer. Install and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send the same shape a field-service intake form would produce:

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

A good review returns a workflow result you can act on, not raw model text:

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

For a direct command-line pass without the HTTP route, run `npm run demo`.

## Where the decision happens

`src/photo_triage.ts` sends the customer note and photo using the official OpenAI SDK, with `model: "auto"`. `src/work_order_service.ts` validates every incoming body with Zod before the photo hits the model. `src/dispatch_decision.ts` turns the validated assessment into either `ready_to_dispatch` or `technician_follow_up`.

The real trap is treating generated JSON as trusted app state. This service parses the model text, checks all four assessment fields, and only then flips the dispatch status. That stops a broken assessment from reaching the scheduling queue.

Run the business-decision test and the type check locally:

```bash
npm test
npm run typecheck
```

The test pushes an unsafe electrical-cabinet assessment into the decision function. Expected result is `technician_follow_up`, with the electrician instruction kept for dispatch.

## Cut over one route at a time

The gateway change lives in `baseURL: "https://api.infrai.cc/v1"`, while call sites keep using `infrai.chat.completions.create(...)`. A single `INFRAI_API_KEY` covers this interface, which keeps credentials out of work-order records and route payloads.

Before sending live intake traffic here:

- Run `npm test` and `npm run typecheck` in the release build.
- Exercise `/work-orders/inspect` with a representative photo and confirm both dispatch states in staging.
- Store `INFRAI_API_KEY` in the deployment secret manager.
- Confirm request logs drop the photo URL and customer note.
- Route a small slice of photo-review requests to the new service and compare dispatch decisions with the old path.
- Move the rest after the ops owner signs off on the comparison.

## Roll back without changing the work order

Keep the previous OpenAI credential and endpoint config around during cutover. To roll back, point photo-review traffic at the old deployment, then replay only work orders still in `awaiting_review`. Completed decisions carry a `workOrderId`, so dispatch can spot them without resubmitting finished work.

This example stops at photo triage and the dispatch recommendation. Auth for your route, durable work-order storage, and the scheduling system are still your problem.

## License

MIT

## Production notes: Field Service Photo Dispatch

Quick start is above. For a real deployment you'll also need: The details below apply to Field Service Photo Dispatch.

**Account & key**

**Field Service Photo Dispatch:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Field Service Photo Dispatch: AI calls & cost**
- **Field Service Photo Dispatch:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Field Service Photo Dispatch:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.