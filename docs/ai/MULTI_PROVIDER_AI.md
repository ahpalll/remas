# Multi AI Provider Management Architecture (Google Gemini + OpenRouter)

## Overview
Phase 37 introduces a resilient Multi-Provider Architecture allowing REMAS Educational Center SaaS to dynamically route student AI requests between **Google Gemini** (`gemini-2.5-flash`) and **OpenRouter API** (`google/gemini-2.5-flash:free` / `openrouter/free` / custom model strings).

## Key Architectural Principles

1. **Provider Abstraction**:
   - `AIProvider` base class in `firebase/ai_provider_interface.js`.
   - `GeminiAIProvider` and `OpenRouterAIProvider` implementations.
   - Client applications (`student_app`) interact strictly through server-side gateway endpoints without awareness of specific backend LLM providers.

2. **Primary & Fallback Provider Routing**:
   - SuperAdmin selects `primaryProvider` (`gemini` or `openrouter`) and optional `fallbackProvider` (`none`, `gemini`, `openrouter`).
   - If the primary provider encounters an operational failure (HTTP 429 rate limit, 5xx backend outage, network timeout), the engine automatically falls back to the configured secondary provider.

3. **Safe Fallback Policy**:
   - **Operational Failures Only**: Fallback is triggered ONLY by operational issues.
   - **Security Errors Halt Immediately**: Errors resulting from `UNAUTHENTICATED_CALLER`, `UNAUTHORIZED_ROLE`, `CROSS_TENANT_VIOLATION`, `ENTITLEMENT_EXPIRED`, `NO_SUBJECT_ENTITLEMENT`, or student daily rate limit **NEVER** trigger provider fallback and fail instantly.

4. **Zero-Downtime Multi-Secret Vault**:
   - Server secret vault (`F:\firebase-secrets\gemini_secret_store.json`) maintains independent secret entries for `GEMINI` and `OPENROUTER`.
   - Candidate keys are tested live before activation. If testing fails, active working keys remain untouched.
   - Zero raw secrets stored in Firestore documents, Git repository, or client bundles.

5. **OpenRouter Free Tier Handling**:
   - OpenRouter Free models (e.g., `google/gemini-2.5-flash:free`) are treated as free-tier options rather than unlimited services.
   - Unavailable free models return clear, safe operational status messages without system crash.
