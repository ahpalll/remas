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
  List<TutorSubjectDTO> _subjects = [];
  String? _selectedSubjectId;
  bool _subjectsLoading = true;
  String? _subjectsError;
  final TextEditingController _topicController = TextEditingController();
  String _explainMode = 'SIMPLE';
  String? _resultText;
  String? _resultError;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadSubjects();
  }

  @override
  void dispose() {
    _topicController.dispose();
    super.dispose();
  }

  Future<void> _loadSubjects() async {
    setState(() {
      _subjectsLoading = true;
      _subjectsError = null;
    });
    try {
      final list = await widget.aiService.fetchSubjects();
      if (!mounted) return;
      setState(() {
        _subjects = list;
        if (list.length == 1) _selectedSubjectId = list.first.subjectId;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _subjectsError = e is TutorApiException
            ? e.message
            : 'تعذر تحميل المواد الدراسية.';
      });
    } finally {
      if (mounted) setState(() => _subjectsLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isSummarize = widget.mode == 'SUMMARIZE';
    final bool isReview = widget.mode == 'REVIEW';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Text(isSummarize
              ? 'تلخيص الدرس الذكي'
              : isReview
                  ? 'مراجعة المادة الذكية'
                  : 'شرح الدرس الذكي'),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_subjectsLoading)
                const Center(child: CircularProgressIndicator())
              else if (_subjectsError != null)
                Card(
                  color: Colors.red.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                            child: Text(_subjectsError!,
                                style: const TextStyle(color: Colors.red))),
                        TextButton(
                          onPressed: _loadSubjects,
                          child: const Text('إعادة المحاولة'),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_subjects.isEmpty)
                const Text('لا توجد مواد متاحة لحسابك حاليًا.')
              else
                DropdownButtonFormField<String>(
                  value: _selectedSubjectId,
                  decoration: const InputDecoration(
                    labelText: 'اختر المادة الدراسية',
                    border: OutlineInputBorder(),
                  ),
                  items: _subjects
                      .map((s) => DropdownMenuItem(
                          value: s.subjectId, child: Text(s.name)))
                      .toList(),
                  onChanged: (val) =>
                      setState(() => _selectedSubjectId = val),
                ),
              const SizedBox(height: 16),
              TextField(
                controller: _topicController,
                decoration: const InputDecoration(
                  labelText: 'الموضوع (اختياري — اتركه فارغًا للعام)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              if (!isSummarize && !isReview) ...[
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
              else if (_resultError != null)
                Card(
                  color: Colors.red.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text(_resultError!,
                        style: const TextStyle(
                            fontSize: 14, color: Colors.red)),
                  ),
                )
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
    if (_selectedSubjectId == null) {
      setState(() => _resultError = 'اختر المادة الدراسية أولًا.');
      return;
    }
    setState(() {
      _isLoading = true;
      _resultError = null;
      _resultText = null;
    });

    final topic = _topicController.text.trim();
    final res = widget.mode == 'SUMMARIZE'
        ? await widget.aiService.summarizeLesson(
            subjectId: _selectedSubjectId,
            topic: topic.isEmpty ? 'لخص أهم النقاط' : topic)
        : widget.mode == 'REVIEW'
            ? await widget.aiService.askQuestion(
                prompt: topic.isEmpty
                    ? 'راجع معي أهم نقاط هذه المادة.'
                    : topic,
                subjectId: _selectedSubjectId,
                mode: 'REVIEW',
              )
            : await widget.aiService.explainLesson(
                subjectId: _selectedSubjectId,
                mode: _explainMode,
                lessonId: null);

    setState(() {
      _isLoading = false;
      if (res['success'] == true) {
        _resultText = (res['response'] ?? '').toString();
        final sources = res['sources'];
        if (sources is List && sources.isNotEmpty) {
          _resultText =
              '$_resultText\n\nالمصادر المعتمدة: ${sources.join('، ')}';
        }
      } else {
        _resultError =
            (res['message'] ?? 'حدث خطأ في الاتصال بالمساعد الذكي.').toString();
      }
    });
  }
}
