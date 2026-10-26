import 'dart:async';
import '../models/ai_models.dart';
import 'mobile_worker_client.dart';
import 'student_service.dart';

class TutorApiException implements Exception {
  final String code;
  final String message;
  final List<dynamic>? institutions;
  const TutorApiException(this.code, this.message, {this.institutions});
  @override
  String toString() => '$code: $message';
}


/// Worker-backed AI Tutor Service for Remas Student App.
/// Security & Architecture (AI-1):
/// - ZERO direct Gemini/OpenRouter API key exposure in client apps.
/// - All AI requests go through Cloudflare Worker (/ai/tutor/*) with Firebase ID Token.
/// - RAG Grounding, Governance limits, and multi-provider failover happen server-side.
class StudentAITutorService {
  final MobileWorkerClient _workerClient;

  StudentAITutorService({
    MobileWorkerClient? workerClient,
  })  : _workerClient = workerClient ?? MobileWorkerClient();

  static int _reqCounter = 0;
  static String generateRequestId() {
    _reqCounter++;
    return 'tutor_${DateTime.now().microsecondsSinceEpoch}_$_reqCounter';
  }

  /// Legacy stub: setting API keys on the client is deprecated and disabled for security.
  static void setApiKey(String key) {}

  /// Fetches enrolled subjects for the active student via Worker or local cache.
  Future<List<TutorSubjectDTO>> fetchSubjects() async {
    try {
      final res = await _workerClient.get('/ai/tutor/subjects');
      final rawSubjects = res['subjects'];
      if (rawSubjects is List && rawSubjects.isNotEmpty) {
        return rawSubjects.map((s) {
          final m = Map<String, dynamic>.from(s as Map);
          return TutorSubjectDTO(
            subjectId: (m['subjectId'] ?? m['id'] ?? '').toString(),
            name: (m['name'] ?? m['subjectName'] ?? '').toString(),
          );
        }).toList();
      }
    } catch (_) {}

    try {
      final studentService = StudentService();
      final groups = await studentService.fetchStudentGroups();
      final seen = <String>{};
      final list = <TutorSubjectDTO>[];

      for (final g in groups) {
        if (g.subjectName.isNotEmpty && !seen.contains(g.subjectName)) {
          seen.add(g.subjectName);
          list.add(TutorSubjectDTO(subjectId: g.id, name: g.subjectName));
        }
      }

      if (list.isNotEmpty) return list;

      final profile = await studentService.fetchCurrentStudentProfile();
      if (profile != null) {
        final subs = await studentService.fetchInstitutionSubjects(profile.institutionId);
        return subs.map((s) => TutorSubjectDTO(subjectId: s.id, name: s.name)).toList();
      }
    } catch (_) {}

    return [
      TutorSubjectDTO(subjectId: 'general', name: 'عام / جميع المواد'),
    ];
  }

  /// Ask a question to the AI Tutor (Interactive chat) via Cloudflare Worker
  Future<Map<String, dynamic>> askQuestion({
    required String prompt,
    String? subjectId,
    String? lessonId,
    String mode = 'EXPLAIN',
    String? requestId,
  }) async {
    final cleanPrompt = prompt.trim();
    if (cleanPrompt.isEmpty) {
      return {'success': false, 'errorCode': 'INVALID_INPUT', 'message': 'يرجى كتابة سؤالك أولاً', 'error': 'يرجى كتابة سؤالك أولاً'};
    }
    if (subjectId == null || subjectId.isEmpty) {
      return {'success': false, 'errorCode': 'SUBJECT_REQUIRED', 'message': 'المادة مطلوبة.', 'error': 'المادة مطلوبة.'};
    }

    final studentService = StudentService();
    final profile = await studentService.fetchCurrentStudentProfile();
    final instId = profile?.institutionId ?? studentService.activeMembership?.institutionId;

    final reqId = requestId ?? generateRequestId();

    try {
      final res = await _workerClient.post('/ai/tutor/ask', {
        'query': cleanPrompt,
        'subjectId': subjectId,
        'lessonId': lessonId,
        'mode': mode,
        'requestId': reqId,
        if (instId != null && instId.isNotEmpty) 'institutionId': instId,
      });

      final answer = (res['answer'] ?? res['response'] ?? '').toString().trim();
      final rawCitations = res['citations'] as List? ?? [];
      final citations = rawCitations.map((c) {
        if (c is Map && c['display'] != null) return c['display'].toString();
        if (c is Map && c['title'] != null) return c['title'].toString();
        return c.toString();
      }).toList();

      final usage = res['usage'] as Map? ?? {};
      final limit = (usage['limit'] is num) ? (usage['limit'] as num).toInt() : 100;
      final used = (usage['used'] is num) ? (usage['used'] as num).toInt() : 0;
      final remaining = (limit - used).clamp(0, 99999);

      return {
        'success': true,
        'response': answer,
        'answer': answer,
        'provider': (res['provider'] ?? 'Cloudflare AI Gateway').toString(),
        'model': (res['model'] ?? 'gemini-2.5-flash').toString(),
        'remainingQuota': remaining,
        'sources': citations.isNotEmpty ? citations : ['المنهج الدراسي المعتمد'],
      };
    } on MobileWorkerException catch (e) {
      return {
        'success': false,
        'errorCode': e.code,
        'message': e.message,
      };
    } catch (e) {
      return {
        'success': false,
        'errorCode': 'AI_ERROR',
        'message': 'تعذر الاتصال بالمساعد الذكي: $e',
      };
    }
  }

  /// Ask about a specific lesson
  Future<Map<String, dynamic>> askAboutLesson({
    required String lessonId,
    required String prompt,
    String? subjectId,
  }) async {
    if (subjectId == null || subjectId.isEmpty) {
      return {'success': false, 'errorCode': 'SUBJECT_REQUIRED', 'error': 'المادة مطلوبة.'};
    }
    return askQuestion(prompt: prompt, subjectId: subjectId, lessonId: lessonId);
  }

  static String mapGetErrorCode(dynamic error) {
    if (error == 401) return 'UNAUTHENTICATED';
    if (error == 403) return 'FORBIDDEN';
    if (error == 409) return 'SELECT_INSTITUTION';
    if (error == 429) return 'QUOTA_EXCEEDED';
    if (error == 500) return 'PROVIDER_ERROR';
    if (error is TutorApiException) return error.code;
    return 'UNKNOWN_ERROR';
  }

  /// Explain a lesson in detail or simply
  Future<Map<String, dynamic>> explainLesson({
    String? lessonId,
    String? subjectId,
    String mode = 'SIMPLE',
    String? requestId,
    String lessonTitle = '',
  }) async {
    final title = lessonTitle.isNotEmpty ? lessonTitle : (subjectId ?? 'الدرس');
    final prompt = mode == 'SIMPLE'
        ? 'اشرح لي درس "$title" بأسلوب مبسط جداً مع أهم 3 نقاط رئيسية وأمثلة توضيحية.'
        : 'اشرح لي درس "$title" شرحاً وافياً وشاملاً مع القوانين، المفاهيم الأساسية، والأسئلة الشائعة في الامتحانات.';

    return askQuestion(
      prompt: prompt,
      subjectId: subjectId,
      lessonId: lessonId,
      mode: mode == 'SIMPLE' ? 'EXPLAIN' : 'DEEP',
      requestId: requestId,
    );
  }

  /// Summarize a lesson into quick revision points
  Future<Map<String, dynamic>> summarizeLesson({
    String? lessonId,
    String? subjectId,
    String topic = 'لخص أهم النقاط',
    String? requestId,
  }) async {
    final studentService = StudentService();
    final profile = await studentService.fetchCurrentStudentProfile();
    final instId = profile?.institutionId ?? studentService.activeMembership?.institutionId;
    final reqId = requestId ?? generateRequestId();

    try {
      final res = await _workerClient.post('/ai/tutor/summarize', {
        'query': topic,
        'subjectId': subjectId,
        'lessonId': lessonId,
        'requestId': reqId,
        if (instId != null && instId.isNotEmpty) 'institutionId': instId,
      });

      final answer = (res['answer'] ?? res['response'] ?? '').toString().trim();
      return {
        'success': true,
        'response': answer,
        'answer': answer,
        'provider': (res['provider'] ?? 'Cloudflare AI Gateway').toString(),
        'sources': ['المنهج الدراسي المعتمد'],
      };
    } catch (_) {
      final prompt = 'لخص لي موضوع "$topic" في شكل نقاط مركزة وسريعة للمراجعة قبل الامتحان.';
      return askQuestion(prompt: prompt, subjectId: subjectId, lessonId: lessonId, requestId: reqId);
    }
  }

  /// Generate interactive multiple-choice self-test questions via Worker
  Future<List<AISelfTestQuestionDTO>> generateSelfTest({
    required String topic,
    String? subjectId,
    String difficulty = 'MEDIUM',
    int count = 3,
    String? requestId,
  }) async {
    if (subjectId == null || subjectId.isEmpty) {
      throw const TutorApiException('SUBJECT_REQUIRED', 'المادة مطلوبة للاختبار الذاتي.');
    }
    final safeCount = count.clamp(1, 5);
    final studentService = StudentService();
    final profile = await studentService.fetchCurrentStudentProfile();
    final instId = profile?.institutionId ?? studentService.activeMembership?.institutionId;
    final reqId = requestId ?? generateRequestId();

    try {
      final res = await _workerClient.post('/ai/tutor/selftest', {
        'query': topic,
        'subjectId': subjectId,
        'difficulty': difficulty,
        'count': safeCount,
        'requestId': reqId,
        if (instId != null && instId.isNotEmpty) 'institutionId': instId,
      });

      final practice = res['practiceQuestions'];
      if (practice is List && practice.isNotEmpty) {
        return practice.map((item) {
          final m = Map<String, dynamic>.from(item as Map);
          final rawOpts = m['options'] as List? ?? [];
          final opts = rawOpts.map((o) {
            if (o is Map && o['text'] != null) return o['text'].toString();
            return o.toString();
          }).toList();

          int correctIdx = 0;
          if (m['correctOptionIds'] is List && (m['correctOptionIds'] as List).isNotEmpty) {
            final targetId = (m['correctOptionIds'] as List).first.toString();
            final found = rawOpts.indexWhere((o) => o is Map && o['optionId']?.toString() == targetId);
            if (found >= 0) correctIdx = found;
          } else if (m['correctAnswerIndex'] != null) {
            correctIdx = int.tryParse(m['correctAnswerIndex'].toString()) ?? 0;
          }

          return AISelfTestQuestionDTO(
            id: (m['id'] ?? 'q_${practice.indexOf(item)}').toString(),
            questionText: (m['prompt'] ?? m['questionText'] ?? 'سؤال').toString(),
            options: opts,
            correctAnswerIndex: correctIdx.clamp(0, opts.isNotEmpty ? opts.length - 1 : 0),
            explanation: (m['explanation'] ?? 'إجابة صحيحة وفق المنهج الدراسي.').toString(),
          );
        }).toList();
      }
    } catch (_) {}

    // Safe offline fallback
    return [
      AISelfTestQuestionDTO(
        id: 'q_default_1',
        questionText: 'ما هي أهم خطوة للاستيعاب الجيد في موضوع: $topic؟',
        options: [
          'المراجعة الدورية وحل التمارين بانتظام',
          'تأجيل المذاكرة لليلة الامتحان',
          'قراءة العناوين فقط دون حل أسئلة',
          'حفظ القوانين دون فهم التطبيق'
        ],
        correctAnswerIndex: 0,
        explanation: 'المراجعة الدورية والتطبيق العملي بحل الأسئلة يثبت المعلومة بنسبة تفوق 80%.',
      ),
    ];
  }

  Future<List<AIStudyPlanItemDTO>> generateStudyPlan({
    required String targetDate,
    String? subjectId,
    String? requestId,
  }) async {
    if (subjectId == null || subjectId.isEmpty) {
      throw const TutorApiException('SUBJECT_REQUIRED', 'المادة مطلوبة لتوليد خطة المذاكرة.');
    }
    final prompt = '''
ضع خطة مذاكرة ذكية وعملية لمادة "${subjectId ?? 'المواد الدراسية'}" حتى موعد "$targetDate".
أعطني 5 خطوات أو جلسات مراجعة محددة، واذكر عنوان الموضوع والنشاط المقترح والمدة التقريبية بالدقائق.
''';

    try {
      final res = await askQuestion(prompt: prompt, subjectId: subjectId, requestId: requestId);
      if (res['success'] == true && res['response'] != null) {
        final answer = res['response'].toString();
        final lines = answer.split('\n').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

        final items = <AIStudyPlanItemDTO>[];
        int step = 1;
        for (final line in lines) {
          if (line.startsWith('*') || line.startsWith('-') || RegExp(r'^\d+\.').hasMatch(line)) {
            final clean = line.replaceAll(RegExp(r'^[\*\-\d\.\s]+'), '');
            if (clean.length > 5) {
              items.add(AIStudyPlanItemDTO(
                day: 'الجلسة $step',
                subjectName: subjectId ?? 'مراجعة',
                topic: clean.length > 60 ? '${clean.substring(0, 60)}…' : clean,
                durationMinutes: 45,
                activity: clean,
              ));
              step++;
              if (items.length >= 5) break;
            }
          }
        }
        if (items.isNotEmpty) return items;
      }
    } catch (_) {}

    return [
      AIStudyPlanItemDTO(
        day: 'اليوم الأول',
        subjectName: subjectId ?? 'مراجعة عامة',
        topic: 'مراجعة المفاهيم والقوانين الأساسية',
        durationMinutes: 45,
        activity: 'قراءة ملخص الفصل وتحديد النقاط الصعبة',
      ),
      AIStudyPlanItemDTO(
        day: 'اليوم الثاني',
        subjectName: subjectId ?? 'حل تمارين',
        topic: 'حل نماذج وتدريبات الامتحانات',
        durationMinutes: 60,
        activity: 'حل أسئلة كتاب السنتر والامتحانات السابقة',
      ),
    ];
  }

  /// Analyze Academic Weaknesses from real grades
  Future<AIWeaknessReportDTO> analyzeWeaknesses() async {
    throw const TutorApiException('NOT_AVAILABLE', 'التحليل الأكاديمي غير متاح حالياً.');
  }
}

class TutorSubjectDTO {
  final String subjectId;
  final String name;

  TutorSubjectDTO({required this.subjectId, required this.name});

  factory TutorSubjectDTO.fromJson(Map<String, dynamic> json) {
    return TutorSubjectDTO(
      subjectId: (json['subjectId'] ?? '').toString(),
      name: (json['name'] ?? json['subjectId'] ?? '').toString(),
    );
  }
}
