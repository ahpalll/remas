/// AI-6 learning modes. Keys MUST stay within the server TUTOR_MODES set
/// (EXPLAIN/SIMPLIFY/GUIDE/HINT/CHECK_UNDERSTANDING/REVIEW/STUDY_PLAN) —
/// the Worker rejects anything else with INVALID_INPUT. Single source for
/// the chat mode picker; tested by contract pin below.
class AiLearningModes {
  static const Map<String, String> chatModes = {
    'EXPLAIN': 'شرح مفصّل',
    'SIMPLIFY': 'تبسيط خطوة بخطوة',
    'GUIDE': 'توجيه دون حل مباشر',
    'HINT': 'تلميح واحد فقط',
    'CHECK_UNDERSTANDING': 'اختبر فهمي',
    'REVIEW': 'مراجعة سريعة',
  };

  static const Set<String> serverModes = {
    'EXPLAIN',
    'SIMPLIFY',
    'GUIDE',
    'HINT',
    'CHECK_UNDERSTANDING',
    'REVIEW',
    'STUDY_PLAN',
  };

  static bool isSupported(String mode) => serverModes.contains(mode);
}
