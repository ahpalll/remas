import 'dart:async';
import '../models/ai_models.dart';

/// Client Service for Student AI Educational Tutor
class StudentAITutorService {
  /// Sends educational question to trusted backend AI gateway
  Future<Map<String, dynamic>> askQuestion({
    required String prompt,
    String? subjectId,
    String? lessonId,
  }) async {
    if (prompt.trim().isEmpty) {
      return {
        'success': false,
        'errorCode': 'INVALID_INPUT',
        'message': 'الرجاء إدخال سؤال خالي من الفراغات.'
      };
    }

    // Simulated client call to trusted backend endpoint
    await Future.delayed(const Duration(milliseconds: 300));

    final bool isLessonScoped = lessonId != null && lessonId.isNotEmpty;
    return {
      'success': true,
      'status': 'SUCCESS',
      'provider': 'MockLocalAIProvider',
      'response': isLessonScoped
          ? 'بناءً على الشرح المعتمد لدرس الرياضيات (التفاضل والتكامل):\n- مشتقة sin(x) هي cos(x).\n- التكامل المحدود يحسب المساحة تحت المنحنى.'
          : 'أهلاً بك! دعنا نفهم خطوات الحل معاً:\n1. حدد المعطيات الأساسية في السؤال.\n2. طبق القانون المناسب للمادة الدراسية.\n3. تحقق من الناتج النهائي.',
      'sources': isLessonScoped ? ['درس التفاضل والتكامل - سنتر الأمل'] : ['المحتوى التعليمي المعتمد للمركز'],
    };
  }

  /// Asks specific question about a lesson or video ("اسأل عن الدرس / الفيديو")
  Future<Map<String, dynamic>> askAboutLesson({
    required String lessonId,
    required String prompt,
  }) async {
    return askQuestion(prompt: prompt, lessonId: lessonId);
  }

  /// Requests lesson explanation ("اشرح لي الدرس")
  Future<Map<String, dynamic>> explainLesson({
    required String lessonId,
    String mode = 'SIMPLE',
  }) async {
    final String prompt = mode == 'SIMPLE' ? 'اشرح لي الدرس بطريقة مبسطة' : 'اشرح لي الدرس بالتفصيل والشرح الكامل';
    return askQuestion(prompt: prompt, lessonId: lessonId);
  }

  /// Requests lesson summary ("لخص لي")
  Future<Map<String, dynamic>> summarizeLesson({
    required String lessonId,
  }) async {
    final String prompt = 'قدم تلخيصاً مركزاً لهذا الدرس يشمل النقاط والقوانين الأساسية.';
    return askQuestion(prompt: prompt, lessonId: lessonId);
  }

  /// Requests structured quiz questions ("اختبرني")
  Future<List<AISelfTestQuestionDTO>> generateSelfTest({
    required String topic,
    String difficulty = 'MEDIUM',
    int count = 3,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return [
      AISelfTestQuestionDTO(
        id: 'q_1',
        questionText: 'ما هي مشتقة دالة الجيب sin(x) بالنسبة للمتغير x؟',
        options: ['cos(x)', '-cos(x)', 'tan(x)', 'sec^2(x)'],
        correctAnswerIndex: 0,
        explanation: 'مشتقة sin(x) تساوي cos(x) وفقاً لقواعد التفاضل الأساسية.',
      ),
      AISelfTestQuestionDTO(
        id: 'q_2',
        questionText: 'ينص قانون أوم في الفيزياء على أن V تساوي:',
        options: ['I * R', 'I / R', 'R / I', 'I^2 * R'],
        correctAnswerIndex: 0,
        explanation: 'فرق الجهد V يساوي حاصل ضرب شدة التيار I في المقاومة R.',
      ),
      AISelfTestQuestionDTO(
        id: 'q_3',
        questionText: 'التكامل المحدود لدالة يمثل هندسياً:',
        options: ['المساحة تحت المنحنى', 'مماس المنحنى', 'المحيط الخارجي', 'السرعة المتجهة'],
        correctAnswerIndex: 0,
        explanation: 'التكامل المحدود بين نقطتين يحسب المساحة المظللة تحت منحنى الدالة.',
      ),
    ];
  }

  /// Requests non-diagnostic weakness analysis ("تحليل مستواي")
  Future<AIWeaknessReportDTO> analyzeWeaknesses() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return AIWeaknessReportDTO(
      overallPercentage: 92.5,
      strongTopics: ['التفاضل والتكامل', 'الميكانيكا والهندسة الفراغية'],
      weakTopics: ['الفيزياء الحديثة والكهربية'],
      recommendations: [
        'مراجعة ملخص وحدة الفيزياء الحديثة قبل اختبار الأسبوع القادم.',
        'حل 5 أسئلة إضافية على قانون أوم وقوانين كيرشوف.'
      ],
    );
  }

  /// Requests interactive study plan timetable ("خطة مذاكرتي")
  Future<List<AIStudyPlanItemDTO>> generateStudyPlan({
    required String targetDate,
  }) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return [
      AIStudyPlanItemDTO(day: 'الأحد', subjectName: 'الرياضيات', topic: 'التفاضل والتكامل', durationMinutes: 45, activity: 'مراجعة المفاهيم وحل أسئلة'),
      AIStudyPlanItemDTO(day: 'الثلاثاء', subjectName: 'الفيزياء', topic: 'الكهربية والفيزياء الحديثة', durationMinutes: 60, activity: 'حل تدريبات سابقة'),
      AIStudyPlanItemDTO(day: 'الخميس', subjectName: 'شامل', topic: 'مراجعة نقاط الضعف والاختبارات الذاتية', durationMinutes: 45, activity: 'اختبار ذاتي شامل'),
    ];
  }
}
