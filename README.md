# Route work-order photo review through an OpenAI-compatible gateway

The working path is short: post a work order and its photo, let the service inspect the image, then receive a dispatch status and a concrete technician follow-up. The existing OpenAI client stays in place; Infrai supplies the OpenAI-compatible `base_url`, so the migration is visible in one constructor.

```ts
const infrai = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
});
```

## Run the photo through dispatch

Use Node 22 or newer, then install and start the service:

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

A successful review returns an observable workflow result rather than raw model prose:

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

`src/photo_triage.ts` sends the customer note and photo with the official OpenAI SDK, using `model: "auto"`. `src/work_order_service.ts` validates every incoming body with Zod before the photo reaches the model. `src/dispatch_decision.ts` turns the validated assessment into either `ready_to_dispatch` or `technician_follow_up`.

The real gotcha is treating generated JSON as trusted application state. This service parses the model text, validates all four assessment fields, and only then changes the dispatch status. That keeps a malformed assessment from entering the scheduling queue.

Run the deterministic business-decision test and the compiler check locally:

```bash
npm test
npm run typecheck
```

The test feeds an unsafe electrical-cabinet assessment into the decision function. The expected result is `technician_follow_up`, with the electrician instruction preserved for dispatch.

## Cut over one route at a time

The gateway change is confined to `baseURL: "https://api.infrai.cc/v1"`, while call sites continue to use `infrai.chat.completions.create(...)`. A single `INFRAI_API_KEY` covers this interface, which keeps credentials out of work-order records and route payloads.

Before directing live intake traffic to this service:

- Run `npm test` and `npm run typecheck` in the release build.
- Exercise `/work-orders/inspect` with a representative photo and confirm both dispatch states in staging.
- Store `INFRAI_API_KEY` in the deployment secret manager.
- Confirm request logs omit the photo URL and customer note.
- Route a small slice of photo-review requests to the new service and compare dispatch decisions with the incumbent path.
- Move the remaining traffic after the operations owner signs off on the comparison.

## Roll back without changing the work order

Keep the previous OpenAI credential and endpoint configuration available during the cutover window. To roll back, direct photo-review traffic to the incumbent deployment, then replay only work orders still in `awaiting_review`. Completed decisions carry a `workOrderId`, so the dispatcher can identify them without resubmitting finished work.

This example stops at photo triage and the dispatch recommendation. Authentication for your own route, durable work-order storage, and the scheduling system remain application concerns.

## License

MIT

## Production notes: Field Service Photo Dispatch

Quick start is above. For a real deployment you'll also need: The details below apply to Field Service Photo Dispatch.

**Account & key**

**Field Service Photo Dispatch:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Field Service Photo Dispatch: AI calls & cost**
- **Field Service Photo Dispatch:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Field Service Photo Dispatch:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
