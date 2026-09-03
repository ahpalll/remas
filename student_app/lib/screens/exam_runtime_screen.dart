import 'package:flutter/material.dart';
import '../services/online_exam_service.dart';

class ExamRuntimeScreen extends StatefulWidget {
  final String examId;
  final String title;

  const ExamRuntimeScreen({super.key, required this.examId, required this.title});

  @override
  State<ExamRuntimeScreen> createState() => _ExamRuntimeScreenState();
}

class _ExamRuntimeScreenState extends State<ExamRuntimeScreen> {
  final OnlineExamStudentService _service = OnlineExamStudentService();
  bool _loading = true;
  int _currentIndex = 0;
  List<dynamic> _questions = [];
  final Map<String, String> _selectedAnswers = {};
  String? _attemptId;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _startAttempt();
  }

  Future<void> _startAttempt() async {
    final res = await _service.startExam(widget.examId);
    setState(() {
      _attemptId = res['attemptId'];
      _questions = res['questions'] ?? [];
      _loading = false;
    });
  }

  Future<void> _selectOption(String questionId, String optionId) async {
    setState(() {
      _selectedAnswers[questionId] = optionId;
    });
    if (_attemptId != null) {
      await _service.saveAnswer(_attemptId!, questionId, optionId, 1);
    }
  }

  Future<void> _submitExam() async {
    if (_attemptId == null) return;
    setState(() {
      _submitting = true;
    });

    final res = await _service.submitExam(_attemptId!);
    if (!mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('تم تسليم الامتحان بنجاح'),
        content: Text('النتيجة: ${res['resultStatus']}\nالنسبة: ${res['percentage']}'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('موافق'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.title)),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final currentQuestion = _questions[_currentIndex];
    final options = (currentQuestion['options'] as List? ?? []);

    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.title} (${_currentIndex + 1}/${_questions.length})'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              currentQuestion['prompt'] ?? '',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ListView.builder(
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final opt = options[index];
                  final optionId = opt['optionId'];
                  final selected = _selectedAnswers[currentQuestion['questionId']] == optionId;
                  return Card(
                    color: selected ? Colors.blue.shade50 : Colors.white,
                    child: ListTile(
                      title: Text(opt['text'] ?? ''),
                      leading: Radio<String>(
                        value: optionId,
                        groupValue: _selectedAnswers[currentQuestion['questionId']],
                        onChanged: (val) {
                          if (val != null) _selectOption(currentQuestion['questionId'], val);
                        },
                      ),
                      onTap: () => _selectOption(currentQuestion['questionId'], optionId),
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                ElevatedButton(
                  onPressed: _currentIndex > 0 ? () => setState(() => _currentIndex--) : null,
                  child: const Text('السابق'),
                ),
                if (_currentIndex < _questions.length - 1)
                  ElevatedButton(
                    onPressed: () => setState(() => _currentIndex++),
                    child: const Text('التالي'),
                  )
                else
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                    onPressed: _submitting ? null : _submitExam,
                    child: _submitting ? const CircularProgressIndicator(color: Colors.white) : const Text('تسليم الامتحان'),
                  ),
              ],
            )
          ],
        ),
      ),
    );
  }
}
