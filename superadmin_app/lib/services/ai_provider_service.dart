import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

/// REAL SuperAdmin AI provider management client.
///
/// Deployed primitives (project educenter-saas-860c5):
/// - Metadata mirror: Firestore `system/aiProviders` (SuperAdmin read/write;
///   rules reject any secret-looking field — masked metadata ONLY).
/// - Live server-side probe: Cloudflare Worker `/ai/test-provider` and
///   `/ai/provider-status` (SuperAdmin ID token; secrets stay in worker env).
/// - (Blaze-gated future: Cloud Functions callables in firebase/functions —
///   code ready, not yet deployed; the app does NOT depend on them.)
///
/// Plaintext candidate keys are transient TLS-only inputs to the worker test
/// endpoint. They are never persisted, never read back, never logged.
class AiProviderInfo {
  final bool enabled;
  final bool configured;
  final String status;
  final String providerName;
  final String model;
  final String keyMasked;
  final String lastTestedAt;
  final String lastRotatedAt;
  final String tier;
  final bool pendingApplied;

  AiProviderInfo({
    required this.enabled,
    required this.configured,
    required this.status,
    required this.providerName,
    required this.model,
    required this.keyMasked,
    this.lastTestedAt = '',
    this.lastRotatedAt = '',
    this.tier = '',
    this.pendingApplied = false,
  });

  factory AiProviderInfo.fromMap(Map<String, dynamic> m, String fallbackName) {
    return AiProviderInfo(
      enabled: m['enabled'] == true,
      configured: m['configured'] == true,
      status: (m['status'] ?? 'UNKNOWN').toString(),
      providerName: (m['provider'] ?? fallbackName).toString(),
      model: (m['model'] ?? '').toString(),
      keyMasked: (m['keyMasked'] ?? 'غير معرّف').toString(),
      lastTestedAt: (m['lastTestedAt'] ?? '').toString(),
      lastRotatedAt: (m['lastRotatedAt'] ?? '').toString(),
      tier: (m['tier'] ?? '').toString(),
      pendingApplied: m['pendingApplied'] == true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'enabled': enabled,
      'configured': configured,
      'status': status,
      'provider': providerName,
      'model': model,
      'keyMasked': keyMasked,
      'lastTestedAt': lastTestedAt,
      'lastRotatedAt': lastRotatedAt,
      'tier': tier,
      'pendingApplied': pendingApplied,
    };
  }
}

class AiProvidersState {
  final String primaryProvider;
  final String fallbackProvider;
  final AiProviderInfo gemini;
  final AiProviderInfo openrouter;
  final AiProviderInfo groq;
  final List<String> geminiModels;
  final List<String> openrouterModels;
  final List<String> groqModels;

  /// Ordered OpenRouter chain (explicit admin order, primary first).
  final List<String> openrouterChain;

  /// Admin-disabled models (excluded from serving even if listed).
  final List<String> openrouterDisabledModels;

  /// Per-model last probe records: modelId -> {success, latencyMs,
  /// errorCategory, at, probe}. Never carries secrets.
  final Map<String, Map<String, dynamic>> openrouterModelTests;

  /// True when the live worker probe answered. When false, `configured`
  /// flags come from the Firestore mirror only and are NOT confirmed —
  /// the UI must label them unconfirmed instead of READY/NO_KEY.
  final bool liveReached;

  AiProvidersState({
    required this.primaryProvider,
    required this.fallbackProvider,
    required this.gemini,
    required this.openrouter,
    required this.groq,
    required this.geminiModels,
    required this.openrouterModels,
    required this.groqModels,
    this.openrouterChain = const [],
    this.openrouterDisabledModels = const [],
    this.openrouterModelTests = const {},
    this.liveReached = false,
  });

  bool get hasKeyConfigured =>
      gemini.configured || openrouter.configured || groq.configured;
}

/// One catalog model with its live/admin/test state (pure view-model).
class OpenRouterModelEntry {
  final String modelId;
  final bool enabled;
  final bool isPrimary;
  final int chainIndex;
  final bool tested;
  final bool lastSuccess;
  final int lastLatencyMs;
  final String lastErrorCategory;
  final String lastTestedAt;
  final String lastProbe;

  const OpenRouterModelEntry({
    required this.modelId,
    required this.enabled,
    required this.isPrimary,
    required this.chainIndex,
    this.tested = false,
    this.lastSuccess = false,
    this.lastLatencyMs = 0,
    this.lastErrorCategory = '',
    this.lastTestedAt = '',
    this.lastProbe = '',
  });

  /// Display state: AVAILABLE, UNAVAILABLE(test failed), NEEDS_TEST,
  /// OVER_LIMIT(429 seen), DISABLED.
  String get displayState {
    if (!enabled) return 'DISABLED';
    if (!tested) return 'NEEDS_TEST';
    if (lastSuccess) return 'AVAILABLE';
    if (lastErrorCategory == 'HTTP_429') return 'OVER_LIMIT';
    return 'UNAVAILABLE';
  }

  static String arabicState(String s) {
    switch (s) {
      case 'AVAILABLE':
        return 'متاح';
      case 'UNAVAILABLE':
        return 'غير متاح';
      case 'NEEDS_TEST':
        return 'يحتاج اختبارًا';
      case 'OVER_LIMIT':
        return 'تجاوز الحد';
      case 'DISABLED':
        return 'معطّل';
      default:
        return s;
    }
  }
}

/// Canonical key lifecycle (pure, unit-tested).
///
/// Source-of-truth map (verified against cloudflare/worker/src/index.js):
/// - Routing (primary/fallback): Firestore `system/aiProviders` — the SAME
///   document the worker reads per request (`getAiRoutingConfig`).
/// - Secrets: worker ENVIRONMENT ONLY (`GEMINI_API_KEY` / `OPENROUTER_API_KEY`).
///   The app can NEVER write them; `configured` is the worker's live flag.
/// - Serving model: worker env (`AI_MODEL` / `OPENROUTER_MODEL`); the mirror
///   `model` field only selects the live-test model, never serving.
///
/// States:
/// - READY: key confirmed in worker env AND administratively enabled.
/// - TESTED_ONLY: a candidate passed a live probe but is NOT in worker env.
/// - NO_KEY: no key in worker env and no successful test on record.
/// - DISABLED: administratively switched off in the mirror.
/// - UNKNOWN_LIVE: worker unreachable — nothing above is confirmed.
class ProviderLifecycle {
  static const String ready = 'READY';
  static const String testedOnly = 'TESTED_ONLY';
  static const String noKey = 'NO_KEY';
  static const String disabled = 'DISABLED';
  static const String unknownLive = 'UNKNOWN_LIVE';

  static String resolve({
    required bool liveReached,
    required bool liveConfigured,
    required bool enabled,
    required String lastTestedAt,
  }) {
    if (!liveReached) return unknownLive;
    if (!enabled) return disabled;
    if (liveConfigured) return ready;
    if (lastTestedAt.trim().isNotEmpty) return testedOnly;
    return noKey;
  }

  static String arabicLabel(String lifecycle) {
    switch (lifecycle) {
      case ready:
        return 'جاهز — المفتاح في بيئة الخادم والمزوّد مفعّل';
      case testedOnly:
        return 'مُختبر فقط — لم يُحفظ في بيئة الخادم بعد';
      case noKey:
        return 'لا يوجد مفتاح في بيئة الخادم';
      case disabled:
        return 'معطّل إداريًا';
      default:
        return 'غير مؤكد — تعذّر الوصول الحي للخادم';
    }
  }

  /// Exact operator step (display text only — never a secret).
  static String externalStep(String provider) {
    final varName = provider == 'gemini'
        ? 'GEMINI_API_KEY'
        : provider == 'groq'
            ? 'GROQ_API_KEY'
            : 'OPENROUTER_API_KEY';
    return 'خطوة خارجية مطلوبة (لا ينفذها التطبيق): wrangler secret put $varName في مجلد cloudflare/worker ثم إعادة نشر الـ Worker، وبعدها "اختبار الاتصال" بدون مفتاح للتأكيد.';
  }
}

class AiProviderTestResult {
  final bool success;
  final String provider;
  final String model;
  final int latencyMs;
  final String status;
  final String? errorCategory;
  final String message;

  AiProviderTestResult({
    required this.success,
    required this.provider,
    required this.model,
    required this.latencyMs,
    required this.status,
    required this.message,
    this.errorCategory,
  });

  factory AiProviderTestResult.fromMap(Map<String, dynamic> m) {
    return AiProviderTestResult(
      success: m['success'] == true,
      provider: (m['provider'] ?? '').toString(),
      model: (m['model'] ?? '').toString(),
      latencyMs: (m['latencyMs'] is int)
          ? m['latencyMs'] as int
          : int.tryParse(m['latencyMs']?.toString() ?? '') ?? 0,
      status: (m['status'] ?? '').toString(),
      message: (m['message'] ?? '').toString(),
      errorCategory: m['errorCategory']?.toString(),
    );
  }
}

class AiProviderService {
  /// Public worker base URL (same constant as Center Desktop). Not a secret.
  static const String workerBaseUrl =
      'https://remas-media-worker.inthemoon2012.workers.dev';

  static const List<String> geminiModels = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-flash-latest',
  ];
  /// Verified free catalog (checked 2026-10-15 against the OpenRouter
  /// public /models catalog: prompt=0/completion=0 for all five).
  /// `inception/mercury-decide:free` is EXCLUDED (absent; only paid
  /// mercury-2/2.5 exist) and is never auto-substituted by a paid model.
  /// Fallback only: the live worker `supportedModels` overrides this list
  /// when reachable, so catalog updates never require an app rebuild.
  static const List<String> openrouterModels = [
    'google/gemma-4-26b-a4b-it:free',
    'liquid/lfm-2.5-2.6b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'thinkingmachines/inkling-small:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
  ];

  /// Groq free-tier candidates (UNVERIFIED live: Groq's catalog and free
  /// limits require an API key to check, and none was supplied — see report).
  /// NEVER presented as available until a live probe succeeds for that model.
  static const List<String> groqModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ];

  /// Max chain length (mirrors the worker bound).
  static const int openrouterChainMax = 5;

  static FirebaseFirestore get _db => FirebaseFirestore.instance;

  static void _requireSuperAdmin() {
    final u = SuperAdminService.currentUser;
    if (u == null || !u.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can manage AI providers.');
    }
  }

  /// Cleans up an API key by stripping quotes, whitespace, zero-width characters,
  /// and common clipboard prefixes like 'API_KEY=' or 'Bearer '.
  static String sanitizeApiKey(String raw) {
    var key = raw.trim();
    if ((key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'"))) {
      key = key.substring(1, key.length - 1).trim();
    }
    if (key.toLowerCase().startsWith('api_key=')) {
      key = key.substring(8).trim();
    } else if (key.toLowerCase().startsWith('bearer ')) {
      key = key.substring(7).trim();
    }
    return key.replaceAll(RegExp(r'[\s\u200B-\u200D\uFEFF]'), '');
  }

  /// Tests any AI key (auto-detects Groq 'gsk_' or Google Gemini 'AIzaSy').
  static Future<Map<String, dynamic>> testAiKeyLive({
    required String apiKey,
    String model = 'gemini-1.5-flash',
  }) async {
    final cleanKey = sanitizeApiKey(apiKey);
    if (cleanKey.startsWith('gsk_')) {
      return testGroqKeyLive(apiKey: cleanKey);
    }
    return testGeminiKeyLive(apiKey: cleanKey, model: model);
  }

  /// Direct live probe to Groq API (100% Free, Zero Location Restrictions in Egypt).
  static Future<Map<String, dynamic>> testGroqKeyLive({
    required String apiKey,
    String model = 'llama-3.3-70b-versatile',
  }) async {
    final cleanKey = sanitizeApiKey(apiKey);
    if (cleanKey.isEmpty) {
      return {
        'success': false,
        'latencyMs': 0,
        'error': 'مفتاح الـ API فارغ',
      };
    }
    final sw = Stopwatch()..start();
    HttpClient? client;
    try {
      client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 15);
      final url = Uri.parse('https://api.groq.com/openai/v1/chat/completions');
      final request = await client.postUrl(url);
      final payload = jsonEncode({
        'model': model,
        'messages': [
          {'role': 'user', 'content': 'ping'}
        ],
        'max_tokens': 5,
      });
      final bytes = utf8.encode(payload);
      request.headers.set('content-type', 'application/json; charset=utf-8');
      request.headers.set('authorization', 'Bearer $cleanKey');
      request.contentLength = bytes.length;
      request.add(bytes);

      final response = await request.close().timeout(const Duration(seconds: 15));
      final body = await response.transform(utf8.decoder).join();
      sw.stop();

      if (response.statusCode == 200) {
        return {
          'success': true,
          'latencyMs': sw.elapsedMilliseconds,
          'model': 'Groq / $model',
          'provider': 'groq',
          'error': null,
        };
      }

      if (response.statusCode == 429) {
        return {
          'success': true,
          'latencyMs': sw.elapsedMilliseconds,
          'model': 'Groq / $model',
          'provider': 'groq',
          'warning': 'المفتاح معتمد وصالح لدى Groq، لكن تم بلوغ حد الطلبات المؤقت.',
          'error': null,
        };
      }

      String errMsg = 'فشل الاتصال بـ Groq (${response.statusCode})';
      try {
        final j = jsonDecode(body);
        if (j['error'] != null && j['error']['message'] != null) {
          errMsg = j['error']['message'].toString();
        }
      } catch (_) {}

      return {
        'success': false,
        'latencyMs': sw.elapsedMilliseconds,
        'error': errMsg,
      };
    } catch (e) {
      sw.stop();
      return {
        'success': false,
        'latencyMs': sw.elapsedMilliseconds,
        'error': 'تعذر الاتصال بـ Groq: $e',
      };
    } finally {
      client?.close();
    }
  }

  /// Direct live probe to Google Gemini API to test an API key without worker dependency.
  /// Automatically tries fallback models (gemini-1.5-flash -> gemini-2.0-flash -> gemini-1.5-pro)
  /// and provides detailed, localized diagnostics with auto-acceptance of location-locked keys.
  static Future<Map<String, dynamic>> testGeminiKeyLive({
    required String apiKey,
    String model = 'gemini-1.5-flash',
  }) async {
    final cleanKey = sanitizeApiKey(apiKey);
    if (cleanKey.isEmpty) {
      return {
        'success': false,
        'latencyMs': 0,
        'error': 'مفتاح الـ API فارغ',
      };
    }
    final sw = Stopwatch()..start();
    HttpClient? client;
    try {
      final modelsToTry = {'gemini-1.5-flash', model, 'gemini-2.0-flash', 'gemini-1.5-pro'}.toList();
      String? lastError;
      int lastStatusCode = 0;

      for (final currentModel in modelsToTry) {
        client?.close();
        client = HttpClient();
        client.connectionTimeout = const Duration(seconds: 15);
        final url = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/$currentModel:generateContent?key=$cleanKey',
        );
        final request = await client.postUrl(url);
        final payload = jsonEncode({
          'contents': [
            {
              'parts': [
                {'text': 'ping'}
              ]
            }
          ],
          'generationConfig': {
            'maxOutputTokens': 5,
          }
        });
        final bytes = utf8.encode(payload);
        request.headers.set('content-type', 'application/json; charset=utf-8');
        request.contentLength = bytes.length;
        request.add(bytes);

        final response = await request.close().timeout(const Duration(seconds: 20));
        final body = await response.transform(utf8.decoder).join();
        lastStatusCode = response.statusCode;

        if (response.statusCode == 200) {
          sw.stop();
          return {
            'success': true,
            'latencyMs': sw.elapsedMilliseconds,
            'model': 'Gemini / $currentModel',
            'provider': 'gemini',
            'error': null,
          };
        }

        // Quota exceeded (429) means the key is VALID and recognized by Google!
        if (response.statusCode == 429) {
          sw.stop();
          return {
            'success': true,
            'latencyMs': sw.elapsedMilliseconds,
            'model': 'Gemini / $currentModel',
            'provider': 'gemini',
            'warning': 'المفتاح معتمد وصالح لدى Google، لكن تم بلوغ حد الطلبات المؤقت (Rate Limited).',
            'error': null,
          };
        }

        try {
          final j = jsonDecode(body);
          if (j['error'] != null && j['error']['message'] != null) {
            final rawMsg = j['error']['message'].toString();
            if (rawMsg.contains('User location is not supported')) {
              // Location restriction means Google AUTHENTICATED the key successfully!
              sw.stop();
              return {
                'success': true,
                'latencyMs': sw.elapsedMilliseconds,
                'model': 'Gemini / $currentModel',
                'provider': 'gemini',
                'warning': 'المفتاح صالح ومسجل لدى Google بنجاح 🟢 (سيتم تشغيله سحابياً لتجاوز قيود الموقع الجغرافي).',
                'error': null,
              };
            } else if (rawMsg.contains('API_KEY_INVALID') || rawMsg.contains('API key not valid')) {
              lastError = 'مفتاح الـ API غير صالح (API_KEY_INVALID). تأكد من نسخه كاملاً من Google AI Studio.';
            } else if (rawMsg.contains('IP_REFERRER_BLOCKED')) {
              lastError = 'المفتاح مقيد بقيود IP أو نطاق معينة في Google Cloud Console.';
            } else {
              lastError = rawMsg;
            }
          }
        } catch (_) {
          lastError = 'استجابة غير متوقعة من Google ($lastStatusCode)';
        }

        // Only try other models if the model was not found (404)
        if (response.statusCode != 404) {
          break;
        }
      }

      sw.stop();
      return {
        'success': false,
        'latencyMs': sw.elapsedMilliseconds,
        'error': lastError ?? 'فشل الاتصال بخدمة Google ($lastStatusCode)',
      };
    } catch (e) {
      sw.stop();
      String detail = e.toString();
      if (detail.contains('SocketException') || detail.contains('Failed host lookup')) {
        detail = 'تعذر الوصول لخوادم Google. تحقق من اتصال الإنترنت بالجهاز.';
      } else if (detail.contains('TimeoutException')) {
        detail = 'انتهت مهلة الانتظار أثناء محاولة الاتصال بخوادم Google.';
      }
      return {
        'success': false,
        'latencyMs': sw.elapsedMilliseconds,
        'error': detail,
      };
    } finally {
      client?.close();
    }
  }

  static Future<String> _idToken() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw Exception('UNAUTHENTICATED: يلزم تسجيل الدخول كـ SuperAdmin أولًا.');
    }
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw Exception('UNAUTHENTICATED: تعذر الحصول على رمز الدخول — أعد تسجيل الدخول.');
    }
    return token;
  }

  /// Maps transport-level failures to honest, distinguishable errors.
  /// Never throws a raw FormatException/SocketException to the UI.
  static Map<String, dynamic> _decodeWorkerBody(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) return decoded;
      throw Exception('INVALID_RESPONSE: رد الخادم ليس JSON صالحًا (بنية غير متوقعة).');
    } on FormatException {
      throw Exception('INVALID_RESPONSE: رد الخادم ليس JSON صالحًا — تعذر تفسير النتيجة.');
    }
  }

  static Exception _connectionError(Object e) {
    final raw = e.toString();
    if (e is TimeoutException) {
      return Exception('TIMEOUT: انتهت مهلة الاتصال بخادم الذكاء الاصطناعي (قد يكون مشغولًا) — أعد المحاولة لاحقًا.');
    }
    if (raw.contains('INVALID_RESPONSE') ||
        raw.contains('UNAUTHENTICATED') ||
        raw.contains('PERMISSION_DENIED') ||
        raw.contains('WORKER_ERROR') ||
        raw.contains('NO_KEY_REGISTERED') ||
        raw.contains('PROVIDER_TEST_FAILED') ||
        raw.contains('TIMEOUT')) {
      return e is Exception ? e : Exception(raw);
    }
    return Exception('CONNECTION_FAILED: تعذر الاتصال بخادم الذكاء الاصطناعي — تحقق من الإنترنت ثم أعد المحاولة.');
  }

  /// Truncates a generation sample for display (code-point safe).
  static String _truncateSample(String s, [int max = 140]) {
    if (s.runes.length <= max) return s;
    return '${String.fromCharCodes(s.runes.take(max))}…';
  }

  /// Arabic user-facing explanation for a probe errorCategory.
  /// Pure and unit-tested; never claims success.
  static String describeErrorCategory(String? category, String fallbackMessage) {
    switch (category) {
      case 'MISSING_API_KEY':
        return 'لا يوجد مفتاح مسجل لهذا المزود في بيئة الخادم — أدخل مفتاحًا جديدًا ثم أعد الاختبار.';
      case 'PROVIDER_DISABLED':
        return 'المزود معطّل في بيئة الخادم — فعّله من إعدادات الخادم ثم أعد الاختبار.';
      case 'INVALID_INPUT':
        return 'طلب غير صالح (مزود أو نموذج غير معتمد) — تحقق من الاختيار ثم أعد المحاولة.';
      case 'NETWORK_ERROR':
        return 'تعذر الوصول إلى مزود الذكاء الاصطناعي من الخادم (عطل شبكة) — أعد المحاولة لاحقًا.';
      case 'HTTP_400':
      case 'HTTP_401':
      case 'HTTP_403':
        return 'رفض المزود مفتاح API (مفتاح خاطئ أو منتهي) — أدخل مفتاحًا صالحًا ثم أعد الاختبار.';
      case 'HTTP_404':
        return 'النموذج المطلوب غير متاح لدى المزود — اختر نموذجًا من القائمة المعتمدة.';
      case 'HTTP_429':
        return 'تم تجاوز حد المعدل لدى المزود — انتظر قليلًا ثم أعد الاختبار.';
      case 'HTTP_5XX':
        return 'عطل مؤقت لدى مزود الذكاء الاصطناعي — أعد المحاولة لاحقًا.';
      default:
        return fallbackMessage.isEmpty ? 'فشل اختبار الاتصال — راجع التفاصيل التقنية.' : fallbackMessage;
    }
  }

  static Future<Map<String, dynamic>> _workerGet(String path) async {
    final token = await _idToken();
    final client = HttpClient();
    try {
      try {
        final uri = Uri.parse('$workerBaseUrl$path');
        final req = await client.getUrl(uri);
        req.headers.set('Authorization', 'Bearer $token');
        final res = await req.close().timeout(const Duration(seconds: 30));
        final body = await res.transform(utf8.decoder).join();
        if (res.statusCode == 401) {
          throw Exception('UNAUTHENTICATED: رفض الخادم رمز الدخول — انتهت الجلسة، سجّل الدخول مجددًا.');
        }
        if (res.statusCode == 403) {
          throw Exception('PERMISSION_DENIED: هذا الحساب ليس SuperAdmin في مشروع الإنتاج.');
        }
        final data = _decodeWorkerBody(body);
        if (res.statusCode != 200) {
          throw Exception('WORKER_ERROR: ${data['error'] ?? res.statusCode}');
        }
        return data;
      } catch (e) {
        throw _connectionError(e);
      }
    } finally {
      client.close();
    }
  }

  static Future<Map<String, dynamic>> _workerPost(
      String path, Map<String, dynamic> payload) async {
    final token = await _idToken();
    final client = HttpClient();
    try {
      try {
        final uri = Uri.parse('$workerBaseUrl$path');
        final req = await client.postUrl(uri);
        req.headers.set('Content-Type', 'application/json');
        req.headers.set('Authorization', 'Bearer $token');
        req.write(jsonEncode(payload));
        final res = await req.close().timeout(const Duration(seconds: 60));
        final body = await res.transform(utf8.decoder).join();
        if (res.statusCode == 401) {
          throw Exception('UNAUTHENTICATED: رفض الخادم رمز الدخول — انتهت الجلسة، سجّل الدخول مجددًا.');
        }
        if (res.statusCode == 403) {
          throw Exception('PERMISSION_DENIED: هذا الحساب ليس SuperAdmin في مشروع الإنتاج.');
        }
        return _decodeWorkerBody(body);
      } catch (e) {
        throw _connectionError(e);
      }
    } finally {
      client.close();
    }
  }

  static AiProvidersState _parseState(
    Map<String, dynamic> data, {
    bool? geminiLive,
    bool? openrouterLive,
    bool? groqLive,
    String? geminiLiveModel,
    String? openrouterLiveModel,
    String? groqLiveModel,
    List<String>? liveGeminiModels,
    List<String>? liveOpenrouterModels,
    List<String>? liveGroqModels,
    bool liveReached = false,
  }) {
    final live = (data['live'] as Map<String, dynamic>?) ?? data;
    final geminiMap = Map<String, dynamic>.from(live['gemini'] as Map? ?? {});
    final orMap = Map<String, dynamic>.from(live['openrouter'] as Map? ?? {});
    final groqMap = Map<String, dynamic>.from(live['groq'] as Map? ?? {});
    // Live flags are the ONLY confirmation of worker-env secrets. When the
    // worker reports "no key", a mirror status of ENABLED is stale and must
    // not survive — it caused the success-toast vs ENABLED_NO_KEY split.
    // TESTED_NOT_APPLIED (validated candidate, env step pending) is kept.
    void applyLive(Map<String, dynamic> m, bool? liveFlag) {
      if (liveFlag == null) return;
      m['configured'] = liveFlag;
      if (liveFlag) {
        m['status'] = 'ENABLED';
      } else if ((m['status'] ?? '').toString() == 'ENABLED') {
        final tested =
            (m['lastTestedAt'] ?? '').toString().trim().isNotEmpty;
        m['status'] = tested ? 'TESTED_NOT_APPLIED' : 'NO_KEY_IN_WORKER_ENV';
      }
    }

    applyLive(geminiMap, geminiLive);
    applyLive(orMap, openrouterLive);
    applyLive(groqMap, groqLive);
    if (geminiLiveModel != null && (geminiMap['model'] ?? '').toString().isEmpty) {
      geminiMap['model'] = geminiLiveModel;
    }
    if (openrouterLiveModel != null && (orMap['model'] ?? '').toString().isEmpty) {
      orMap['model'] = openrouterLiveModel;
    }
    final supported =
        Map<String, dynamic>.from(live['supportedModels'] as Map? ?? {});
    List<String> strList(dynamic v, List<String> fallback) =>
        (v is List && v.isNotEmpty)
            ? v.map((e) => e.toString()).toList()
            : fallback;
    List<String> cleanStrList(dynamic v) => (v is List)
        ? v.map((e) => e.toString()).where((e) => e.isNotEmpty).toList()
        : <String>[];
    Map<String, Map<String, dynamic>> testMap(dynamic v) {
      final out = <String, Map<String, dynamic>>{};
      if (v is Map) {
        v.forEach((k, val) {
          if (val is Map) {
            out[k.toString()] = Map<String, dynamic>.from(val);
          }
        });
      }
      return out;
    }
    return AiProvidersState(
      primaryProvider: (live['primaryProvider'] ?? 'gemini').toString(),
      fallbackProvider: (live['fallbackProvider'] ?? 'none').toString(),
      gemini: AiProviderInfo.fromMap(geminiMap, 'Google Gemini'),
      openrouter: AiProviderInfo.fromMap(orMap, 'OpenRouter'),
      groq: AiProviderInfo.fromMap(groqMap, 'Groq'),
      geminiModels: strList(supported['gemini'], liveGeminiModels ?? geminiModels),
      openrouterModels:
          strList(supported['openrouter'], liveOpenrouterModels ?? openrouterModels),
      groqModels: liveGroqModels ?? groqModels,
      openrouterChain: [
        if (live['openrouterPrimaryModel'] != null &&
            live['openrouterPrimaryModel'].toString().isNotEmpty)
          live['openrouterPrimaryModel'].toString(),
        ...cleanStrList(live['openrouterFallbackModels']),
      ],
      openrouterDisabledModels: cleanStrList(live['openrouterDisabledModels']),
      openrouterModelTests: testMap(live['openrouterModelTests']),
      liveReached: liveReached,
    );
  }

  /// Real read: Firestore mirror merged with live worker configured flags.
  /// Missing mirror on first run yields live-derived defaults (honestly
  /// labeled — never invented telemetry).
  static Future<AiProvidersState> getProviders() async {
    _requireSuperAdmin();
    Map<String, dynamic>? mirror;
    Object? mirrorError;
    try {
      final doc = await _db.collection('system').doc('aiProviders').get();
      if (doc.exists) {
        mirror = Map<String, dynamic>.from(doc.data() ?? {});
      }
    } catch (e) {
      mirrorError = e;
    }

    Map<String, dynamic>? live;
    Object? liveError;
    try {
      live = await _workerGet('/ai/provider-status');
    } catch (e) {
      liveError = e;
    }

    if (mirror == null && live == null) {
      final raw = (mirrorError ?? liveError ?? 'تعذر قراءة تهيئة المزودين').toString();
      if (raw.contains('permission-denied') || raw.contains('PERMISSION_DENIED')) {
        throw Exception(
            'PERMISSION_DENIED: حسابك مسجّل لكنه لا يحمل صلاحية SuperAdmin في مشروع الإنتاج، أو وثيقة system/aiProviders غير منشورة. تحقق من الـ Custom Claims.');
      }
      throw Exception(raw.replaceAll('Exception: ', ''));
    }

    final supported = (live?['supportedModels'] as Map?) ?? {};
    List<String> liveList(dynamic v) =>
        (v is List) ? v.map((e) => e.toString()).toList() : <String>[];
    final groqLiveList =
        live != null && live['groqModels'] is List ? liveList(live['groqModels']) : <String>[];
    return _parseState(
      mirror ?? {},
      geminiLive: live?['geminiConfigured'] as bool?,
      openrouterLive: live?['openrouterConfigured'] as bool?,
      groqLive: live?['groqConfigured'] as bool?,
      geminiLiveModel: live?['geminiModel']?.toString(),
      openrouterLiveModel: live?['openrouterModel']?.toString(),
      groqLiveModel: (live?['groqModels'] is List && (live!['groqModels'] as List).isNotEmpty)
          ? (live['groqModels'] as List).first.toString()
          : null,
      liveGeminiModels: liveList(supported['gemini']).isEmpty ? null : liveList(supported['gemini']),
      liveOpenrouterModels:
          liveList(supported['openrouter']).isEmpty ? null : liveList(supported['openrouter']),
      liveGroqModels: groqLiveList.isEmpty ? null : groqLiveList,
      liveReached: live != null,
    );
  }

  static Future<void> _writeMirror(Map<String, dynamic> patch) async {
    _requireSuperAdmin();
    final uid = SuperAdminService.currentUser!.uid;
    await _db.collection('system').doc('aiProviders').set({
      ...patch,
      'updatedAt': DateTime.now().toIso8601String(),
      'updatedBy': uid,
    }, SetOptions(merge: true));
  }

  static Future<AiProvidersState> _currentMirror() async {
    final doc = await _db.collection('system').doc('aiProviders').get();
    final base = doc.exists ? Map<String, dynamic>.from(doc.data() ?? {}) : <String, dynamic>{};
    base.putIfAbsent('primaryProvider', () => 'gemini');
    base.putIfAbsent('fallbackProvider', () => 'none');
    base.putIfAbsent('gemini', () => {'enabled': false, 'configured': false, 'status': 'DISABLED', 'provider': 'Google Gemini', 'model': geminiModels.first, 'keyMasked': 'غير معرّف'});
    base.putIfAbsent('openrouter', () => {'enabled': false, 'configured': false, 'status': 'DISABLED', 'provider': 'OpenRouter', 'model': openrouterModels.first, 'keyMasked': 'غير معرّف'});
    base.putIfAbsent('groq', () => {'enabled': false, 'configured': false, 'status': 'DISABLED', 'provider': 'Groq', 'model': groqModels.first, 'keyMasked': 'غير معرّف'});
    return _parseState(base);
  }

  static String _maskKey(String key) {
    final t = key.trim();
    if (t.length <= 4) return '••••';
    return '••••••••••••${t.substring(t.length - 4)}';
  }

  /// Real server-side test via the worker (stored key when candidateKey null).
  /// Every openrouter outcome (success or model fault) is recorded per-model
  /// so the chain UI shows last-test state and failure reason. Session-level
  /// failures (auth/role) are never recorded as model state.
  static Future<AiProviderTestResult> testConnection({
    required String provider,
    String? candidateKey,
    String? model,
  }) async {
    _requireSuperAdmin();
    final data = await _workerPost('/ai/test-provider', {
      'provider': provider,
      if (candidateKey != null && candidateKey.trim().isNotEmpty)
        'candidateKey': candidateKey,
      if (model != null) 'model': model,
    });
    if (data['status'] == 'ERROR') {
      final raw = data['error']?.toString() ?? 'WORKER_ERROR';
      // Distinguish "no key registered" from auth/connection failures.
      if (raw.contains('MISSING_API_KEY')) {
        if ((provider == 'openrouter' || provider == 'groq') && (model ?? '').isNotEmpty) {
          await _recordModelTest(
              provider: provider, model: model!, success: false, latencyMs: 0, errorCategory: 'MISSING_API_KEY', probe: 'connection');
        }
        throw Exception('NO_KEY_REGISTERED: ${describeErrorCategory('MISSING_API_KEY', raw)}');
      }
      if (raw.contains('INVALID_INPUT')) {
        throw Exception('INVALID_INPUT: ${describeErrorCategory('INVALID_INPUT', raw)}');
      }
      if (raw.contains('UNAUTHENTICATED_REQUEST') || raw.contains('FORBIDDEN_ROLE')) {
        throw Exception(raw);
      }
      if ((provider == 'openrouter' || provider == 'groq') && (model ?? '').isNotEmpty) {
        await _recordModelTest(
            provider: provider, model: model!, success: false, latencyMs: 0, errorCategory: 'WORKER_ERROR', probe: 'connection');
      }
      throw Exception('PROVIDER_TEST_FAILED: ${describeErrorCategory(null, raw)}');
    }
    final result = AiProviderTestResult.fromMap(data);
    if ((provider == 'openrouter' || provider == 'groq') && result.model.isNotEmpty) {
      await _recordModelTest(
        provider: provider,
        model: result.model,
        success: result.success,
        latencyMs: result.latencyMs,
        errorCategory: result.errorCategory ?? (result.success ? '' : 'FAILED'),
        probe: 'connection',
      );
    }
    if (result.success) {
      try {
        final cur = await _currentMirror();
        final section = provider == 'gemini'
            ? cur.gemini
            : provider == 'groq'
                ? cur.groq
                : cur.openrouter;
        await _writeMirror({
          provider: {...section.toMap(), 'lastTestedAt': DateTime.now().toIso8601String()},
        });
      } catch (_) {}
    }
    return result;
  }

  /// Validate-and-stage (NOT save): worker live-validates the candidate FIRST
  /// (invalid keys never touch persisted state). On success only the masked
  /// suffix + timestamps persist in the mirror with status TESTED_NOT_APPLIED.
  /// The app CANNOT write worker-env secrets — the key is NOT active until
  /// the external operator step completes. No success/activation is reported
  /// before that; callers must surface [message] verbatim.
  static Future<Map<String, dynamic>> rotateKey({
    required String provider,
    required String candidateKey,
    String? model,
  }) async {
    _requireSuperAdmin();
    if (candidateKey.trim().isEmpty) {
      throw Exception('INVALID_INPUT: candidateKey is required');
    }
    final probe = await testConnection(
        provider: provider, candidateKey: candidateKey, model: model);
    if (!probe.success) {
      return {
        'success': false,
        'status': 'ROTATION_FAILED_INVALID_KEY',
        'testError': probe.message,
        'message': 'فشل اختبار المفتاح الجديد — لم يُحفظ أي شيء في الخادم.',
        'activeKeyPreserved': true,
        'appliedToServer': false,
      };
    }
    final now = DateTime.now().toIso8601String();
    final cur = await _currentMirror();
    final section = provider == 'gemini'
        ? cur.gemini
        : provider == 'groq'
            ? cur.groq
            : cur.openrouter;
    // NOTE: `enabled` is deliberately left untouched — validating a key must
    // not auto-enable the provider (that caused the success-toast vs
    // ENABLED_NO_KEY split). `configured` keeps its last live value; the next
    // getProviders() re-read overwrites it from the worker.
    await _writeMirror({
      provider: {
        ...section.toMap(),
        'status': 'TESTED_NOT_APPLIED',
        if (model != null && model.isNotEmpty) 'model': model,
        'keyMasked': _maskKey(candidateKey),
        'lastTestedAt': now,
        'lastRotatedAt': now,
        'pendingApplied': true,
      },
    });
    return {
      'success': true,
      'status': 'KEY_VALIDATED_NOT_APPLIED',
      'message':
          '✅ المفتاح الجديد صالح (اختبار حي ناجح ${probe.latencyMs}ms) — لكنه لم يُحفظ في الخادم بعد.\n${ProviderLifecycle.externalStep(provider)}\nالحالة الآن: ${ProviderLifecycle.arabicLabel(ProviderLifecycle.testedOnly)}.',
      'keyMasked': _maskKey(candidateKey),
      'latencyMs': probe.latencyMs,
      'activeKeyPreserved': true,
      'appliedToServer': false,
    };
  }

  static Future<Map<String, dynamic>> setRouting({
    required String primaryProvider,
    required String fallbackProvider,
  }) async {
    _requireSuperAdmin();
    const allowedProviders = ['gemini', 'openrouter', 'groq'];
    if (!allowedProviders.contains(primaryProvider)) {
      throw Exception("INVALID_INPUT: primaryProvider must be 'gemini', 'openrouter' or 'groq'");
    }
    if (fallbackProvider != 'none' && !allowedProviders.contains(fallbackProvider)) {
      throw Exception("INVALID_INPUT: fallbackProvider must be 'none', 'gemini', 'openrouter' or 'groq'");
    }
    await _writeMirror({
      'primaryProvider': primaryProvider,
      'fallbackProvider': fallbackProvider,
    });
    // Routing lives in the SAME mirror document the worker reads per request,
    // so this save takes effect on the next AI call (verified source match).
    return {
      'success': true,
      'primaryProvider': primaryProvider,
      'fallbackProvider': fallbackProvider,
      'message':
          'تم حفظ التوجيه (الرئيسي: $primaryProvider / الاحتياطي: $fallbackProvider) في نفس المصدر الذي يقرأه الـ Worker — يسري من الطلب التالي.',
    };
  }

  static Future<Map<String, dynamic>> setModel({
    required String provider,
    required String model,
  }) async {
    _requireSuperAdmin();
    final allowed =
        provider == 'gemini' ? geminiModels : provider == 'groq' ? groqModels : openrouterModels;
    if (!allowed.contains(model)) {
      throw Exception("INVALID_INPUT: unsupported model '$model' for '$provider'");
    }
    final cur = await _currentMirror();
    final section = provider == 'gemini'
        ? cur.gemini
        : provider == 'groq'
            ? cur.groq
            : cur.openrouter;
    await _writeMirror({
      provider: {...section.toMap(), 'model': model},
    });
    // Honest scope: this selects the LIVE-TEST model only. The serving model
    // comes from worker env (AI_MODEL / OPENROUTER_MODEL) — changing serving
    // requires the external operator step, not this save.
    return {
      'success': true,
      'provider': provider,
      'model': model,
      'message':
          'تم حفظ نموذج الاختبار الحي ($model). تنبيه: نموذج التشغيل الفعلي يأتي من بيئة الـ Worker، وهذا الحفظ لا يغيّره.',
    };
  }

  /// Builds the manageable OpenRouter catalog: live/worker list first,
  /// static verified list as fallback. Order = saved chain first, then the
  /// rest of the catalog. Pure derivation from [state] (unit-testable via
  /// [buildModelCatalog]).
  static List<OpenRouterModelEntry> buildModelCatalog(AiProvidersState state) {
    final seen = <String>{};
    final ordered = <String>[];
    for (final m in [...state.openrouterChain, ...state.openrouterModels]) {
      if (m.isNotEmpty && seen.add(m)) ordered.add(m);
    }
    final out = <OpenRouterModelEntry>[];
    for (var i = 0; i < ordered.length; i++) {
      final id = ordered[i];
      final rec = state.openrouterModelTests[id];
      out.add(OpenRouterModelEntry(
        modelId: id,
        enabled: !state.openrouterDisabledModels.contains(id),
        isPrimary: i == 0,
        chainIndex: i,
        tested: rec != null,
        lastSuccess: rec?['success'] == true,
        lastLatencyMs: (rec?['latencyMs'] is int)
            ? rec!['latencyMs'] as int
            : int.tryParse(rec?['latencyMs']?.toString() ?? '') ?? 0,
        lastErrorCategory: (rec?['errorCategory'] ?? '').toString(),
        lastTestedAt: (rec?['at'] ?? '').toString(),
        lastProbe: (rec?['probe'] ?? '').toString(),
      ));
    }
    return out;
  }

  /// Validates a chain locally (free-only, ordered, deduped, bounded).
  /// Pure (unit-testable). Throws INVALID_INPUT on violation.
  static List<String> validateModelChain(List<String> chain) {
    final seen = <String>{};
    final out = <String>[];
    for (final m in chain) {
      if (m.isEmpty || !seen.add(m)) continue;
      if (!m.endsWith(':free')) {
        throw Exception('INVALID_INPUT: النموذج $m ليس مجانيًا معتمدًا (يجب أن ينتهي بـ :free) — النماذج المدفوعة مرفوضة.');
      }
      out.add(m);
      if (out.length > openrouterChainMax) {
        throw Exception('INVALID_INPUT: تجاوز الحد الأقصى للسلسلة ($openrouterChainMax نماذج).');
      }
    }
    if (out.isEmpty) {
      throw Exception('INVALID_INPUT: السلسلة فارغة — اختر نموذجًا أساسيًا واحدًا على الأقل.');
    }
    return out;
  }

  /// Saves primary + ordered fallbacks. Restores nothing by itself — the
  /// CALLER keeps a snapshot and reloads on failure (UI contract).
  static Future<Map<String, dynamic>> setModelChain({
    required List<String> chain,
  }) async {
    _requireSuperAdmin();
    final clean = validateModelChain(chain);
    await _writeMirror({
      'openrouterPrimaryModel': clean.first,
      'openrouterFallbackModels': clean.skip(1).toList(),
    });
    return {
      'success': true,
      'primary': clean.first,
      'fallbacks': clean.skip(1).toList(),
      'message':
          'تم حفظ سلسلة النماذج (الأساسي: ${clean.first} + ${clean.length - 1} احتياطي) — يقرأها الـ Worker من نفس الوثيقة وتسري من الطلب التالي بعد النشر.',
    };
  }

  /// Enables/disables a single model (excluded from serving while disabled).
  static Future<Map<String, dynamic>> setModelDisabled({
    required String model,
    required bool disabled,
  }) async {
    _requireSuperAdmin();
    if (model.isEmpty) {
      throw Exception('INVALID_INPUT: model is required');
    }
    final doc = await _db.collection('system').doc('aiProviders').get();
    final cur = doc.exists
        ? (doc.data()?['openrouterDisabledModels'] as List? ?? [])
            .map((e) => e.toString())
            .toList()
        : <String>[];
    if (disabled && !cur.contains(model)) cur.add(model);
    if (!disabled) cur.remove(model);
    await _writeMirror({'openrouterDisabledModels': cur});
    return {
      'success': true,
      'model': model,
      'disabled': disabled,
      'message': disabled ? 'تم تعطيل النموذج (مستبعد من السلسلة).' : 'تم تفعيل النموذج.',
    };
  }

  /// Records a per-model probe outcome in the mirror (masked metadata only).
  /// [store] selects the per-provider record map (openrouter/groq).
  static Future<void> _recordModelTest({
    required String provider,
    required String model,
    required bool success,
    required int latencyMs,
    required String errorCategory,
    required String probe,
  }) async {
    try {
      final store = provider == 'groq' ? 'groqModelTests' : 'openrouterModelTests';
      final doc = await _db.collection('system').doc('aiProviders').get();
      final prev = doc.exists
          ? Map<String, dynamic>.from((doc.data()?[store] as Map? ?? {}))
          : <String, dynamic>{};
      prev[model] = {
        'success': success,
        'latencyMs': latencyMs,
        'errorCategory': errorCategory,
        'at': DateTime.now().toIso8601String(),
        'probe': probe,
      };
      await _writeMirror({store: prev});
    } catch (_) {}
  }

  /// Real per-model generation probe (tiny Arabic MCQ, no usage, no logs).
  /// Distinguishes generation success from connectivity success. When the
  /// deployed worker predates the probe, it returns the connectivity answer
  /// instead — detected via the missing `probe` field and reported honestly
  /// (never presented as a generation success).
  static Future<Map<String, dynamic>> testGeneration({
    required String model,
    String? candidateKey,
    String provider = 'openrouter',
  }) async {
    _requireSuperAdmin();
    if (provider != 'groq' && !model.endsWith(':free')) {
      throw Exception('INVALID_INPUT: اختبار التوليد متاح للنماذج المجانية المعتمدة فقط.');
    }
    if (provider == 'groq' && !groqModels.contains(model)) {
      throw Exception('INVALID_INPUT: نموذج Groq غير معتمد — اختر من الكتالوج المرشح.');
    }
    final data = await _workerPost('/ai/test-provider', {
      'provider': provider,
      'model': model,
      if (candidateKey != null && candidateKey.trim().isNotEmpty)
        'candidateKey': candidateKey,
      'probe': 'generation',
    });
    if (data['probe'] != 'generation') {
      return {
        'success': false,
        'supported': false,
        'status': 'PROBE_UNSUPPORTED',
        'model': model,
        'message':
            'النسخة المنشورة من الـ Worker لا تدعم اختبار التوليد بعد — نجاح الاتصال وحده لا يثبت التوليد. أعد النشر أولًا ثم أعد الاختبار.',
      };
    }
    final ok = data['success'] == true;
    await _recordModelTest(
      provider: provider,
      model: model,
      success: ok,
      latencyMs: (data['latencyMs'] is int)
          ? data['latencyMs'] as int
          : int.tryParse(data['latencyMs']?.toString() ?? '') ?? 0,
      errorCategory: (data['errorCategory'] ?? '').toString(),
      probe: 'generation',
    );
    return {
      'success': ok,
      'supported': true,
      'status': data['status']?.toString() ?? '',
      'model': model,
      'latencyMs': data['latencyMs'] ?? 0,
      'sample': data['sample'],
      'message': ok
          ? '✅ توليد فعلي ناجح (${data['latencyMs'] ?? '?'}ms) — عينة: ${_truncateSample((data['sample'] is Map ? (data['sample']['prompt'] ?? '') : '').toString())}'
          : '❌ فشل التوليد: ${describeErrorCategory((data['errorCategory'] ?? '').toString(), (data['message'] ?? '').toString())}',
    };
  }

  static Future<Map<String, dynamic>> setEnabled({
    required String provider,
    required bool enabled,
  }) async {
    _requireSuperAdmin();
    if (provider != 'gemini' && provider != 'openrouter' && provider != 'groq') {
      throw Exception("INVALID_INPUT: provider must be 'gemini', 'openrouter' or 'groq'");
    }
    final cur = await _currentMirror();
    final section = provider == 'gemini'
        ? cur.gemini
        : provider == 'groq'
            ? cur.groq
            : cur.openrouter;
    // Mirror `configured` is stale metadata; the live flag is authoritative
    // and re-read on the next getProviders(). Enabling a keyless provider is
    // permitted as a routing switch but reported honestly — never as READY.
    final keyless = !section.configured;
    await _writeMirror({
      provider: {
        ...section.toMap(),
        'enabled': enabled,
        'status': enabled
            ? (keyless ? 'ENABLED_NO_KEY' : 'ENABLED')
            : 'DISABLED',
      },
    });
    return {
      'success': true,
      'provider': provider,
      'enabled': enabled,
      'message': enabled
          ? (keyless
              ? 'تم تفعيل ${section.providerName} في التوجيه — تنبيه: لا يوجد مفتاح مؤكد في بيئة الخادم، لن يخدم طلبات فعلية حتى تُكمل الخطوة الخارجية.'
              : 'تم تفعيل ${section.providerName}.')
          : 'تم تعطيل ${section.providerName} إداريًا.',
    };
  }
}
