import 'package:flutter/material.dart';
import '../services/ai_tutor_service.dart';

/// Lesson Explanation & Summarizer Screen
class AILessonExplainerScreen extends StatefulWidget {
  final StudentAITutorService aiService;
  final String mode; // 'EXPLAIN' or 'SUMMARIZE'

  const AILessonExplainerScreen({
    super.key,
    required this.aiService,
    required this.mode,
  });

  @override
  State<AILessonExplainerScreen> createState() => _AILessonExplainerScreenState();
}

class _AILessonExplainerScreenState extends State<AILessonExplainerScreen> {
  String? _selectedLesson = 'les_math_calculus_01';
  String _explainMode = 'SIMPLE';
  String? _resultText;
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final bool isSummarize = widget.mode == 'SUMMARIZE';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Text(isSummarize ? 'تلخيص الدرس الذكي' : 'شرح الدرس الذكي'),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DropdownButtonFormField<String>(
                value: _selectedLesson,
                decoration: const InputDecoration(
                  labelText: 'اختر الدرس المراد شرحه/تلخيصه',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'les_math_calculus_01', child: Text('درس التفاضل والتكامل - رياضيات')),
                  DropdownMenuItem(value: 'les_phys_electro_01', child: Text('درس الكهربية وقانون أوم - فيزياء')),
                ],
                onChanged: (val) => setState(() => _selectedLesson = val),
              ),
              const SizedBox(height: 16),
              if (!isSummarize) ...[
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'SIMPLE', label: Text('شرح مبسط')),
                    ButtonSegment(value: 'DETAILED', label: Text('شرح تفصيلي')),
                  ],
                  selected: {_explainMode},
                  onSelectionChanged: (set) => setState(() => _explainMode = set.first),
                ),
                const SizedBox(height: 16),
              ],
              ElevatedButton.icon(
                onPressed: _isLoading ? null : _generate,
                icon: Icon(isSummarize ? Icons.summarize : Icons.menu_book),
                label: Text(isSummarize ? 'توليد التلخيص' : 'توليد الشرح الذكي'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  backgroundColor: Colors.deepPurple.shade800,
                  foregroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 24),
              if (_isLoading)
                const Center(child: CircularProgressIndicator())
              else if (_resultText != null)
                Card(
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text(_resultText!, style: const TextStyle(fontSize: 15, height: 1.6)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _generate() async {
    if (_selectedLesson == null) return;
    setState(() => _isLoading = true);

    final res = widget.mode == 'SUMMARIZE'
        ? await widget.aiService.summarizeLesson(lessonId: _selectedLesson!)
        : await widget.aiService.explainLesson(lessonId: _selectedLesson!, mode: _explainMode);

    setState(() {
      _isLoading = false;
      _resultText = res['response'];
    });
  }
}
