import '../models/exam_attempt.dart';

class OnlineExamStudentService {
  Future<List<AvailableExamDTO>> fetchAvailableExams() async {
    // Trusted DTO response simulation for student app
    return [
      AvailableExamDTO(
        examId: 'exam_online_101',
        title: 'اختبار الفيزياء الأونلاين - الفصل الأول',
        description: 'اختبار تجريبي في الميكانيكا والهندسة',
        subjectId: 'subj_physics',
        stageId: 'stg_secondary_1',
        durationMinutes: 30,
        totalMarksHundredths: 10000,
        canStart: true,
      )
    ];
  }

  Future<Map<String, dynamic>> startExam(String examId) async {
    return {
      'attemptId': 'attempt_${examId}_stu_current_1',
      'durationMinutes': 30,
      'expiresAt': DateTime.now().add(const Duration(minutes: 30)).toIso8601String(),
      'questions': [
        {
          'id': 'eq_1',
          'questionId': 'q_1',
          'attemptId': 'attempt_${examId}_stu_current_1',
          'prompt': 'ما هي وحدة قياس القوة في النظام الدولي؟',
          'questionType': 'MCQ',
          'marksHundredths': 5000,
          'order': 1,
          'options': [
            {'optionId': 'opt_1', 'text': 'نيوتن (Newton)', 'order': 1},
            {'optionId': 'opt_2', 'text': 'جول (Joule)', 'order': 2},
            {'optionId': 'opt_3', 'text': 'وات (Watt)', 'order': 3},
          ]
        },
        {
          'id': 'eq_2',
          'questionId': 'q_2',
          'attemptId': 'attempt_${examId}_stu_current_1',
          'prompt': 'هل تسارع الجاذبية الأرضية يساوي 9.8 م/ث² تقريباً؟',
          'questionType': 'TRUE_FALSE',
          'marksHundredths': 5000,
          'order': 2,
          'options': []
        }
      ]
    };
  }

  Future<bool> saveAnswer(String attemptId, String questionId, String selectedOptionId, int expectedVersion) async {
    // Answer autosave simulation
    return true;
  }

  Future<Map<String, dynamic>> submitExam(String attemptId) async {
    return {
      'status': 'SUCCESS',
      'resultStatus': 'PASS',
      'earnedMarksHundredths': 10000,
      'totalMarksHundredths': 10000,
      'percentage': '100.0%'
    };
  }
}
