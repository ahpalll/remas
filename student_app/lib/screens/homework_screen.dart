import 'package:flutter/material.dart';
import '../models/student_homework.dart';
import '../services/mobile_worker_client.dart';
import '../services/student_service.dart';
import '../services/student_homework_service.dart';

/// Canonical homework screen (P3): eligible PUBLISHED homework via the
/// trusted Worker layer, own submissions status, and text-answer submission
/// via direct Firestore create (Rules-enforced). Honest empty states.
class HomeworkScreen extends StatefulWidget {
  const HomeworkScreen({super.key});

  @override
  State<HomeworkScreen> createState() => _HomeworkScreenState();
}

class _HomeworkScreenState extends State<HomeworkScreen> {
  final StudentService _studentService = StudentService();
  late final StudentHomeworkService _homeworkService;
  List<StudentHomeworkDTO> _homework = [];
  final Map<String, List<StudentSubmissionDTO>> _submissions = {};
  bool _isLoading = true;
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _homeworkService = StudentHomeworkService(students: _studentService);
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await _studentService.fetchHomework();
      final subs = <String, List<StudentSubmissionDTO>>{};
      for (final h in list) {
        try {
          subs[h.id] = await _studentService.fetchMySubmissions(h.id);
        } catch (_) {
          subs[h.id] = [];
        }
      }
      if (!mounted) return;
      setState(() {
        _homework = list;
        _submissions
          ..clear()
          ..addAll(subs);
        _isLoading = false;
      });
    } on StudentResolutionException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    } on MobileWorkerException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    }
  }

  Future<void> _submit(StudentHomeworkDTO hw) async {
    final controller = TextEditingController();
    final answer = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(hw.title),
        content: TextField(
          controller: controller,
          maxLines: 6,
          decoration: const InputDecoration(
            labelText: 'نص الإجابة',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('إلغاء'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('إرسال'),
          ),
        ],
      ),
    );
    if (answer == null || answer.trim().isEmpty) return;
    setState(() => _isSubmitting = true);
    try {
      await _homeworkService.submitTextAnswer(
        homeworkId: hw.id,
        textAnswer: answer,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم إرسال الواجب بنجاح')),
      );
      setState(() {
        _isLoading = true;
        _isSubmitting = false;
      });
      await _load();
    } on HomeworkSubmitException catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الواجبات المنزلية')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Text(_errorMessage!,
                        textAlign: TextAlign.center),
                  ),
                )
              : _homework.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24.0),
                        child: Text(
                          'لا توجد بيانات متاحة حاليًا.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16.0),
                      itemCount: _homework.length,
                      itemBuilder: (context, index) {
                        final hw = _homework[index];
                        final subs = _submissions[hw.id] ?? [];
                        final graded = subs.where((s) => s.score != null);
                        return Card(
                          elevation: 2,
                          margin: const EdgeInsets.only(bottom: 12),
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(hw.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16)),
                                if ((hw.description ?? '').isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(hw.description!),
                                  ),
                                const SizedBox(height: 8),
                                Text(
                                  'الحالة: ${hw.status} • التسليمات: ${subs.length}${graded.isNotEmpty ? ' • الدرجة: ${graded.first.score}' : ''}',
                                  style: const TextStyle(
                                      color: Colors.grey, fontSize: 12),
                                ),
                                const SizedBox(height: 8),
                                ElevatedButton.icon(
                                  onPressed: _isSubmitting
                                      ? null
                                      : () => _submit(hw),
                                  icon: const Icon(Icons.send, size: 18),
                                  label: Text(subs.isEmpty
                                      ? 'تسليم الإجابة'
                                      : 'إعادة التسليم'),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
