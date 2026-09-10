# AI System Operations & Production Runbook

## 1. System Components
- **Trusted AI Service**: `firebase/ai_tutor_service.js`
- **RAG Engine**: `firebase/rag_retrieval_service.js`
- **Usage Accounting**: `firebase/ai_usage_service.js`
- **Provider Layer**: `firebase/ai_provider_interface.js`
- **Flutter UI Screens**:
  - `student_app/lib/screens/ai_tutor_home_screen.dart` (8 Quick-Action Cards)
  - `student_app/lib/screens/ai_chat_screen.dart` (Interactive Q&A + Lesson/Video Q&A)
  - `student_app/lib/screens/ai_lesson_explainer_screen.dart` (Lesson Explainer & Summarizer)
  - `student_app/lib/screens/ai_self_test_screen.dart` (Self-Test Quiz Runner)
  - `student_app/lib/screens/ai_weakness_screen.dart` (Performance Trend Analysis)
  - `student_app/lib/screens/ai_study_plan_screen.dart` (Interactive Timetable)

## 2. Production Deployment Steps
1. Set the secure environment variable on Cloud Functions / trusted backend server:
   `firebase functions:secrets:set GEMINI_API_KEY`
2. Deploy backend functions:
   `firebase deploy --only functions`
3. Verify live AI status:
   `node firebase/live_verification_service.js`

## 3. Monitoring & Error Troubleshooting

| Symptom | Cause | Resolution |
|---|---|---|
| Response returns `BLOCKED / MISSING_PRODUCTION_CREDENTIALS` | `GEMINI_API_KEY` not configured in server environment | Configure `GEMINI_API_KEY` secret on backend host |
| HTTP 429 `DAILY_LIMIT_EXCEEDED` | Student exceeded 50 queries in 24 hours | Quota resets automatically at midnight UTC |
| `NO_AUTHORIZED_CONTENT_FOUND` | Student is not enrolled in subject or package expired | Verify student group enrollment and active subscription entitlement |
| Prompt rejection `SECURITY_POLICY_VIOLATION` | Student query matched prompt injection guard | Advise student to ask standard educational questions |
