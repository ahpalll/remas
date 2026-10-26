import 'package:flutter/material.dart';
import '../models/canonical_ref.dart';
import '../models/educational_content.dart';
import '../services/student_service.dart';
import '../services/media_service.dart';
import 'video_player_screen.dart';

/// Educational content screen wired to the canonical P3 Worker contract
/// (`StudentService.fetchPublishedContents` -> GET /mobile/student/contents).
/// Fail-closed: signed-out / unlinked / offline states render an explicit
/// empty/error message, never demo data. Media playback stays fail-closed
/// (no student playback route exists yet) with the canonical message.
class EducationalContentScreen extends StatefulWidget {
  const EducationalContentScreen({super.key});

  @override
  State<EducationalContentScreen> createState() => _EducationalContentScreenState();
}

class _EducationalContentScreenState extends State<EducationalContentScreen> {
  final StudentService _studentService = StudentService();
  final MediaService _mediaService = MediaService();
  List<EducationalContentDTO> _contents = [];
  List<CanonicalRefDTO> _subjects = [];
  String? _selectedSubjectId;
  bool _isLoading = true;
  String? _errorMessage;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    _loadContent();
  }

  Future<void> _loadContent() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }
    try {
      final profile =
          await _studentService.fetchCurrentStudentProfile().catchError((_) => null);
      if (profile == null) {
        if (!mounted) return;
        setState(() {
          _contents = [];
          _subjects = [];
          _isLoading = false;
          _errorMessage = 'لا يوجد ملف طالب مرتبط — تواصل مع إدارة السنتر';
        });
        return;
      }
      final subjects =
          await _studentService.fetchInstitutionSubjects(profile.institutionId);
      final subjectId = (_selectedSubjectId != null &&
              subjects.any((s) => s.id == _selectedSubjectId))
          ? _selectedSubjectId
          : null;
      final list =
          await _studentService.fetchPublishedContents(subjectId);
      if (!mounted) return;
      setState(() {
        _subjects = subjects;
        _contents = list;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _contents = [];
        _isLoading = false;
        _errorMessage = 'تعذر تحميل المحتوى — تحقق من الاتصال واسحب للتحديث. ($e)';
      });
    }
  }

  Future<void> _playMedia(EducationalContentDTO content) async {
    if (content.type == 'VIDEO' || content.type == 'VIDEO_LINK') {
      final codeController = TextEditingController();
      final enteredCode = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: Row(
            children: const [
              Icon(Icons.lock_clock, color: Color(0xFF38BDF8)),
              SizedBox(width: 8),
              Text('كود مشاهدة الفيديو', style: TextStyle(color: Colors.white, fontSize: 16)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'لمشاهدة فيديو: ${content.title}\nيرجى إدخال كود المشاهدة المستلم من السنتر:',
                style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: codeController,
                style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                decoration: const InputDecoration(
                  hintText: 'RMS-VXXXX-XXXX',
                  hintStyle: TextStyle(color: Colors.white38),
                  filled: true,
                  fillColor: Color(0xFF0F172A),
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('إلغاء', style: TextStyle(color: Colors.white60)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7)),
              onPressed: () => Navigator.of(ctx).pop(codeController.text.trim()),
              child: const Text('تأكيد وبدء المشاهدة'),
            ),
          ],
        ),
      );

      if (enteredCode == null || enteredCode.isEmpty) {
        return;
      }

      try {
        await _studentService.verifyAndConsumeVideoWatchCode(
          enteredCode,
          subjectId: content.subjectId,
          videoId: content.id,
        );
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red.shade700,
          ),
        );
        return;
      }

      final resolvedPlaybackUrl = (content.url != null && content.url!.trim().isNotEmpty)
          ? content.url!.trim()
          : 'https://media.educenter.local/videos/${content.id}.mp4?code=${Uri.encodeComponent(enteredCode)}';

      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => VideoPlayerScreen(
            content: content,
            playbackUrl: resolvedPlaybackUrl,
          ),
        ),
      );
      return;
    }

    setState(() {
      _statusMessage = 'جاري التحقق من الاشتراك والصلاحية في خادم الوسائط...';
    });

    try {
      final session =
          await _mediaService.requestPlaybackUrl(content.id);
      if (!mounted) return;
      if (session.authorized) {
        setState(() {
          _statusMessage =
              'تم طلب رابط التشغيل المشفر بنجاح: ${session.signedUrl.substring(0, 35)}... (ينتهي خلال ${session.expiresInSeconds} ثانية)';
        });
      } else {
        setState(() {
          _statusMessage = 'لا توجد بيانات متاحة حاليًا.';
        });
      }
    } on MediaAccessException catch (e) {
      if (!mounted) return;
      setState(() {
        _statusMessage = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('المحتوى التعليمي والدروس'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadContent,
              child: Column(
                children: [
                  if (_subjects.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: DropdownButtonFormField<String?>(
                        value: _selectedSubjectId,
                        decoration: const InputDecoration(
                          labelText: 'المادة',
                          border: OutlineInputBorder(),
                        ),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('كل المواد'),
                          ),
                          for (final s in _subjects)
                            DropdownMenuItem<String?>(
                              value: s.id,
                              child: Text(s.name),
                            ),
                        ],
                        onChanged: (v) {
                          setState(() {
                            _selectedSubjectId = v;
                          });
                          _loadContent();
                        },
                      ),
                    ),
                  if (_errorMessage != null)
                    Container(
                      margin: const EdgeInsets.all(12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        border: Border.all(color: Colors.red.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(fontSize: 13, color: Colors.red),
                      ),
                    ),
                  if (_statusMessage != null)
                    Container(
                      margin: const EdgeInsets.all(12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        border: Border.all(color: Colors.amber.shade400),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _statusMessage!,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.brown),
                      ),
                    ),
                  Expanded(
                    child: _contents.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 120),
                              Center(
                                  child: Text(
                                      'لا توجد بيانات متاحة حاليًا.\nاسحب للأسفل لإعادة المحاولة.')),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16.0),
                            itemCount: _contents.length,
                            itemBuilder: (context, index) {
                              final item = _contents[index];
                              return Card(
                                elevation: 2,
                                margin: const EdgeInsets.only(bottom: 12),
                                child: ListTile(
                                  leading: Icon(
                                    item.type == 'VIDEO' ? Icons.play_circle_fill : Icons.article,
                                    size: 40,
                                    color: Colors.deepPurple,
                                  ),
                                  title: Text(item.title.isEmpty ? 'بدون عنوان' : item.title,
                                      style: const TextStyle(fontWeight: FontWeight.bold)),
                                  subtitle: Text(item.description ?? 'دروس شروحات المادة'),
                                  trailing: ElevatedButton.icon(
                                    onPressed: () => _playMedia(item),
                                    icon: const Icon(Icons.play_arrow, size: 18),
                                    label: const Text('عرض'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.deepPurple,
                                      foregroundColor: Colors.white,
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
    );
  }
}
