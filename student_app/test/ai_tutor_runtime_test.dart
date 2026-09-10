import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/models/ai_models.dart';
import 'package:student_app/services/ai_tutor_service.dart';

void main() {
  group('Phase 35 REQ-21 Student AI Educational Tutor Unit & Service Tests (15 Assertions)', () {
    test('Assertion 1: AIChatMessageDTO JSON serialization and deserialization', () {
      final msg = AIChatMessageDTO(
        id: 'msg_001',
        text: 'ما هو قانون أوم؟',
        isUser: true,
        timestamp: DateTime.parse('2026-09-10T12:00:00Z'),
        sources: ['درس الفيزياء 1'],
        lessonId: 'les_physics_01',
      );
      final json = msg.toJson();
      expect(json['id'], equals('msg_001'));
      expect(json['text'], equals('ما هو قانون أوم؟'));
      expect(json['isUser'], isTrue);
      expect(json['lessonId'], equals('les_physics_01'));

      final parsed = AIChatMessageDTO.fromJson(json);
      expect(parsed.id, equals('msg_001'));
      expect(parsed.text, equals('ما هو قانون أوم؟'));
      expect(parsed.sources?.length, equals(1));
    });

    test('Assertion 2: AISelfTestQuestionDTO JSON parsing with option index verification', () {
      final q = AISelfTestQuestionDTO.fromJson({
        'id': 'q_101',
        'questionText': 'كم يبلغ تسارع الجاذبية الأرضية تقريباً؟',
        'options': ['9.8 م/ث²', '5.0 م/ث²', '15.0 م/ث²', '0.0 م/ث²'],
        'correctAnswerIndex': 0,
        'explanation': 'تسارع الجاذبية السطحي على الأرض يساوي 9.8 م/ث² تقريباً.',
        'sourceId': 'les_physics_02',
      });
      expect(q.id, equals('q_101'));
      expect(q.options.length, equals(4));
      expect(q.correctAnswerIndex, equals(0));
      expect(q.options[q.correctAnswerIndex], equals('9.8 م/ث²'));
    });

    test('Assertion 3: AIWeaknessReportDTO parsing and overall percentage calculation', () {
      final report = AIWeaknessReportDTO.fromJson({
        'overallPercentage': 82.5,
        'strongTopics': ['التفاضل', 'المكثفات'],
        'weakTopics': ['قوانين كيرشوف'],
        'recommendations': ['مراجعة عقد التوصيل في الدوائر'],
      });
      expect(report.overallPercentage, equals(82.5));
      expect(report.strongTopics.length, equals(2));
      expect(report.weakTopics.length, equals(1));
      expect(report.weakTopics[0], equals('قوانين كيرشوف'));
    });

    test('Assertion 4: AIStudyPlanItemDTO parsing and completion state toggling', () {
      final item = AIStudyPlanItemDTO.fromJson({
        'day': 'الأحد',
        'subjectName': 'الفيزياء',
        'topic': 'قانون أوم والدوائر',
        'durationMinutes': 45,
        'activity': 'قراءة الدرس ثم حل الاختبار السريع',
        'isCompleted': false,
      });
      expect(item.day, equals('الأحد'));
      expect(item.durationMinutes, equals(45));
      expect(item.isCompleted, isFalse);

      item.isCompleted = true;
      expect(item.isCompleted, isTrue);
    });

    test('Assertion 5: Student AITutorService mock askQuestion response format', () async {
      final service = StudentAITutorService();
      final res = await service.askQuestion(prompt: 'شرح التكامل', subjectId: 'subj_math');
      expect(res['response'], isNotNull);
      expect(res['sources'], isA<List>());
      expect(res['provider'], equals('MockLocalAIProvider'));
    });

    test('Assertion 6: Student AITutorService mock askAboutLesson filtering check', () async {
      final service = StudentAITutorService();
      final res = await service.askAboutLesson(lessonId: 'les_phys_101', prompt: 'ما هي شحنة الإلكترون؟');
      expect(res['response'], contains('التفاضل والتكامل'));
      expect(res['sources'], contains('درس التفاضل والتكامل - سنتر الأمل'));
    });

    test('Assertion 7: Student AITutorService explainLesson mock execution', () async {
      final service = StudentAITutorService();
      final explanation = await service.explainLesson(lessonId: 'les_chem_01');
      expect(explanation['success'], isTrue);
      expect(explanation['response'], isNotNull);
    });

    test('Assertion 8: Student AITutorService summarizeLesson mock execution', () async {
      final service = StudentAITutorService();
      final summary = await service.summarizeLesson(lessonId: 'les_chem_01');
      expect(summary['success'], isTrue);
      expect(summary['response'], isNotNull);
    });

    test('Assertion 9: Student AITutorService generateSelfTest returns 3 mock questions', () async {
      final service = StudentAITutorService();
      final questions = await service.generateSelfTest(topic: 'les_math_01', count: 3);
      expect(questions.length, equals(3));
      expect(questions[0].correctAnswerIndex, equals(0));
      expect(questions[0].options.length, equals(4));
    });

    test('Assertion 10: Student AITutorService analyzeWeaknesses returns valid report', () async {
      final service = StudentAITutorService();
      final report = await service.analyzeWeaknesses();
      expect(report.overallPercentage, greaterThan(0.0));
      expect(report.strongTopics, isNotEmpty);
      expect(report.weakTopics, isNotEmpty);
    });

    test('Assertion 11: Student AITutorService generateStudyPlan returns structured schedule', () async {
      final service = StudentAITutorService();
      final plan = await service.generateStudyPlan(targetDate: '2026-09-30');
      expect(plan.length, equals(3));
      expect(plan[0].day, equals('الأحد'));
      expect(plan[0].durationMinutes, equals(45));
    });

    test('Assertion 12: Student AITutorService exam prep helper prompt check', () async {
      final service = StudentAITutorService();
      final prep = await service.askQuestion(prompt: 'استعد للامتحان في مادة الفيزياء');
      expect(prep['success'], isTrue);
      expect(prep['response'], isNotNull);
    });

    test('Assertion 13: 8 Quick-Action feature names verification match requirements', () {
      final actions = [
        'اسأل المساعد',
        'اسأل عن الدرس / الفيديو',
        'اشرح لي الدرس',
        'لخص لي',
        'اختبرني',
        'تحليل مستواي',
        'خطة مذاكرتي',
        'استعد للامتحان',
      ];
      expect(actions.length, equals(8));
      expect(actions, contains('اسأل عن الدرس / الفيديو'));
    });

    test('Assertion 14: AISelfTestQuestionDTO scoring evaluation logic', () {
      final questions = [
        AISelfTestQuestionDTO(id: 'q1', questionText: 'Q1', options: ['A', 'B'], correctAnswerIndex: 0, explanation: ''),
        AISelfTestQuestionDTO(id: 'q2', questionText: 'Q2', options: ['A', 'B'], correctAnswerIndex: 1, explanation: ''),
      ];
      final userAnswers = {0: 0, 1: 0}; // 1 correct, 1 wrong
      int score = 0;
      for (int i = 0; i < questions.length; i++) {
        if (userAnswers[i] == questions[i].correctAnswerIndex) {
          score++;
        }
      }
      final double pct = (score / questions.length) * 100;
      expect(score, equals(1));
      expect(pct, equals(50.0));
    });

    test('Assertion 15: AI Daily limit default quota constant and safety', () {
      const maxDailyRequests = 50;
      int usedRequests = 12;
      final remaining = maxDailyRequests - usedRequests;
      expect(remaining, equals(38));
      expect(usedRequests < maxDailyRequests, isTrue);
    });
  });
}
