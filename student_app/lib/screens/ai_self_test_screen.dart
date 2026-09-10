import 'package:flutter/material.dart';
import '../models/ai_models.dart';
import '../services/ai_tutor_service.dart';

/// Self-Test Generator Screen ("اختبرني")
class AISelfTestScreen extends StatefulWidget {
  final StudentAITutorService aiService;

  const AISelfTestScreen({super.key, required this.aiService});

  @override
  State<AISelfTestScreen> createState() => _AISelfTestScreenState();
}

class _AISelfTestScreenState extends State<AISelfTestScreen> {
  String _difficulty = 'MEDIUM';
  List<AISelfTestQuestionDTO> _questions = [];
  final Map<int, int> _userAnswers = {};
  bool _isLoading = false;
  bool _isSubmitted = false;

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('الاختبار الذاتي التفاعلي')),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('مستوى الصعوبة: ', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(width: 8),
                  DropdownButton<String>(
                    value: _difficulty,
                    items: const [
                      DropdownMenuItem(value: 'EASY', child: Text('سهل')),
                      DropdownMenuItem(value: 'MEDIUM', child: Text('متوسط')),
                      DropdownMenuItem(value: 'HARD', child: Text('صعب')),
                    ],
                    onChanged: (val) => setState(() => _difficulty = val!),
                  ),
                  const Spacer(),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _generateQuiz,
                    child: const Text('توليد أسئلة اختبار جديدة'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_isLoading)
                const Center(child: CircularProgressIndicator())
              else if (_questions.isNotEmpty) ...[
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _questions.length,
                  itemBuilder: (context, qIndex) {
                    final q = _questions[qIndex];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${qIndex + 1}. ${q.questionText}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                            const SizedBox(height: 8),
                            ...List.generate(q.options.length, (optIdx) {
                              return RadioListTile<int>(
                                title: Text(q.options[optIdx]),
                                value: optIdx,
                                groupValue: _userAnswers[qIndex],
                                onChanged: _isSubmitted
                                    ? null
                                    : (val) {
                                        setState(() {
                                          _userAnswers[qIndex] = val!;
                                        });
                                      },
                              );
                            }),
                            if (_isSubmitted) ...[
                              const SizedBox(height: 8),
                              Text(
                                _userAnswers[qIndex] == q.correctAnswerIndex ? 'إجابة صحيحة! أحسنت.' : 'إجابة خاطئة. الإجابة الصحيحة هي: ${q.options[q.correctAnswerIndex]}',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: _userAnswers[qIndex] == q.correctAnswerIndex ? Colors.green : Colors.red,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text('التوضيح: ${q.explanation}', style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
                if (!_isSubmitted)
                  ElevatedButton(
                    onPressed: _userAnswers.length == _questions.length
                        ? () => setState(() => _isSubmitted = true)
                        : null,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      backgroundColor: Colors.deepPurple.shade800,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('تسليم الاختبار ورؤية النتيجة'),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _generateQuiz() async {
    setState(() {
      _isLoading = true;
      _isSubmitted = false;
      _userAnswers.clear();
    });

    final list = await widget.aiService.generateSelfTest(
      topic: 'الرياضيات العامة والفيزياء',
      difficulty: _difficulty,
      count: 3,
    );

    setState(() {
      _questions = list;
      _isLoading = false;
    });
  }
}
