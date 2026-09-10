# AI Privacy & Data Handling Specifications

## 1. Overview & Data Sovereignty
The REMAS Educational Center SaaS Student AI Educational Tutor is designed with strict data privacy and student protection standards. All educational data processed by the AI system remains strictly isolated within the authenticated student's educational institution boundary (`institutionId`).

## 2. Privacy Principles
1. **Zero PII Exposure to LLM Providers**: Student personal identifiable information (full name, email, phone number, national identification, exact grade history, financial transactions) is NEVER sent to Google Gemini or external AI providers.
2. **Context Minimization**: Only authorized, anonymized educational content chunks (lesson summaries, syllabus text, practice questions) and clean prompt queries are included in external LLM calls.
3. **No Model Retraining**: Provider contracts specify that prompt data and context chunks sent to Google Gemini API endpoints are NOT retained for model training or public dataset curation.
4. **Non-Diagnostic Weakness Analysis**: Student performance summaries processed by the weakness engine are strictly limited to non-medical, non-psychological educational progress indicators (e.g., topic mastery percentages).

## 3. Data Flow & Sanitization
```
[ Student App ] --( Authenticated Token )--> [ Trusted Firebase Gateway ]
                                                      |
                                          (Sanitizes PII & Filters Entitlements)
                                                      |
                                                      v
                                        [ Clean Grounded Context & Query ]
                                                      |
                                                      v
                                           [ Google Gemini API ]
```

## 4. Compliance & Auditability
- All AI queries, token counts, and source references are recorded in the `aiUsageLogs` collection for center administrative transparency and usage auditing.
- Content retention policies allow educational center administrators to review generated responses and student query history at any time.
