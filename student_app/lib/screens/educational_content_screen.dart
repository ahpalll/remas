import 'package:flutter/material.dart';
import '../models/educational_content.dart';
import '../models/secure_media.dart';
import '../services/content_service.dart';
import '../services/media_service.dart';

class EducationalContentScreen extends StatefulWidget {
  const EducationalContentScreen({super.key});

  @override
  State<EducationalContentScreen> createState() => _EducationalContentScreenState();
}

class _EducationalContentScreenState extends State<EducationalContentScreen> {
  final ContentService _contentService = ContentService();
  final MediaService _mediaService = MediaService();
  List<EducationalContentDTO> _contents = [];
  bool _isLoading = true;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    _loadContent();
  }

  Future<void> _loadContent() async {
    final list = await _contentService.fetchPublishedContents('subj_math');
    if (mounted) {
      setState(() {
        _contents = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _playMedia(EducationalContentDTO content) async {
    setState(() {
      _statusMessage = 'جاري التحقق من الاشتراك والصلاحية في خادم الوسائط...';
    });

    final SecurePlaybackSessionDTO? session = await _mediaService.requestPlaybackUrl(content.id);

    if (mounted) {
      if (session != null && session.authorized) {
        setState(() {
          _statusMessage = 'تم طلب رابط التشغيل المشفر بنجاح: ${session.signedUrl.substring(0, 35)}... (ينتهي خلال ${session.expiresInSeconds} ثانية)';
        });
      } else {
        setState(() {
          _statusMessage = 'NOT DEPLOYED — PRODUCTION CONFIGURATION REQUIRED: يتطلب تشغيل الوسائط نشر خادم Worker والمجموعة الخاصة لـ Cloudflare R2.';
        });
      }
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
          : Column(
              children: [
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
                      ? const Center(child: Text('لا يوجد محتوى تعليمي منشور حالياً.'))
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
                                title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold)),
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
    );
  }
}
