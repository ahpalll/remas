# AI Usage Accounting & Operational Cost Control

## 1. Daily Student Limits
- Every authenticated student is allocated a daily maximum quota of **50 AI tutor requests** per 24-hour cycle (`MAX_DAILY_AI_REQUESTS = 50`).
- Quota usage is tracked atomically per student in the `aiUsageLogs` Firestore collection using `dailyCount` and `lastResetDate`.
- Upon reaching 50 requests, subsequent queries return HTTP 429 (`DAILY_LIMIT_EXCEEDED`) with message:
  "لقد استنفدت الحد اليومي المسموح به للأسئلة اليوم (50 سؤالاً). يمكنك المحاولة مجدداً غداً."

## 2. Token Accounting & Billing Estimates
- Average query context size: 150 prompt tokens + 100 completion tokens = 250 tokens per request.
- Estimated monthly cost per 1,000 active students (assuming 10 queries/day average):
  - Total queries/month: 300,000 queries.
  - Gemini 1.5 Flash API pricing: ~$0.075 per 1,000,000 input tokens / $0.30 per 1,000,000 output tokens.
  - Estimated Monthly LLM API Cost: **~$12.38 / month** for 1,000 active students.

## 3. Cost Safeguards
1. Server-side request rate limits prevent runaway automated loops.
2. Short maximum completion token caps (`maxOutputTokens: 512`) prevent verbose model generation.
3. Pre-retrieval authorization limits context chunk payload sizes to top 3 relevant chunks ($<1,000$ tokens total context).
