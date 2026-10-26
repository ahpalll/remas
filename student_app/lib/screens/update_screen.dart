import 'dart:io';
import 'package:flutter/material.dart';
import 'package:student_app/services/update_service.dart';
import 'package:open_filex/open_filex.dart';

/// Update screen shown when a new version is available.
/// Downloads the APK, verifies SHA-256 hash, then directs the user
/// to Android's official package installer.
class UpdateScreen extends StatefulWidget {
  final UpdateInfo updateInfo;

  const UpdateScreen({super.key, required this.updateInfo});

  @override
  State<UpdateScreen> createState() => _UpdateScreenState();
}

class _UpdateScreenState extends State<UpdateScreen> {
  bool _downloading = false;
  bool _downloaded = false;
  int _percent = 0;
  String? _error;
  File? _apkFile;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text(
          'تحديث متاح',
          style: TextStyle(color: Colors.white),
        ),
        leading: widget.updateInfo.mandatory
            ? null
            : IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.system_update, size: 64, color: Color(0xFF38BDF8)),
            const SizedBox(height: 16),
            Text(
              'إصدار جديد متاح',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
              textDirection: TextDirection.rtl,
            ),
            const SizedBox(height: 8),
            Text(
              'الإصدار الحالي: v${widget.updateInfo.currentVersion} → الإصدار الجديد: v${widget.updateInfo.version}',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
              textAlign: TextAlign.center,
              textDirection: TextDirection.rtl,
            ),
            const SizedBox(height: 24),
            if (widget.updateInfo.releaseNotes.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'التغييرات الجديدة:',
                      style: TextStyle(
                        color: Color(0xFF38BDF8),
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                      textDirection: TextDirection.rtl,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.updateInfo.releaseNotes,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      textDirection: TextDirection.rtl,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
            if (_downloaded && _apkFile != null) ...[
              const Icon(Icons.check_circle, size: 64, color: Color(0xFF22C55E)),
              const SizedBox(height: 8),
              const Text(
                'تم تنزيل والتحقق من التحديث بنجاح',
                style: TextStyle(color: Color(0xFF22C55E), fontSize: 16),
                textAlign: TextAlign.center,
                textDirection: TextDirection.rtl,
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => _installUpdate(_apkFile!),
                icon: const Icon(Icons.install_mobile),
                label: const Text('تثبيت التحديث'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ] else if (_downloading) ...[
              const CircularProgressIndicator(color: Color(0xFF38BDF8)),
              const SizedBox(height: 16),
              Text(
                'جاري تنزيل التحديث... $_percent%',
                style: const TextStyle(color: Colors.white, fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(value: _percent / 100),
            ] else ...[
              ElevatedButton.icon(
                onPressed: _error != null ? null : _startDownload,
                icon: const Icon(Icons.download),
                label: Text(_error != null ? 'فشل التنزيل' : 'تنزيل التحديث'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFFF87171)),
                  textAlign: TextAlign.center,
                  textDirection: TextDirection.rtl,
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () {
                    setState(() => _error = null);
                    _startDownload();
                  },
                  child: const Text('إعادة المحاولة'),
                ),
              ],
            ],
            const SizedBox(height: 24),
            if (!widget.updateInfo.mandatory)
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text(
                  'تذكيري لاحقًا',
                  style: TextStyle(color: Color(0xFF94A3B8)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _startDownload() async {
    setState(() {
      _downloading = true;
      _error = null;
    });

    final file = await StudentUpdateService.downloadUpdate(
      widget.updateInfo,
      (downloaded, total, percent) {
        if (mounted) setState(() => _percent = percent);
      },
    );

    if (mounted) {
      setState(() {
        _downloading = false;
        if (file != null) {
          _downloaded = true;
          _apkFile = file;
        } else {
          _error = 'فشل تنزيل أو التحقق من التحديث. تحقق من الاتصال بالإنترنت.';
        }
      });
    }
  }

  Future<void> _installUpdate(File apkFile) async {
    try {
      // Open the APK file with the system installer
      final result = await OpenFilex.open(apkFile.path);
      if (result.type != ResultType.done) {
        if (mounted) {
          setState(() {
            _error = 'تعذر فتح المثبت. افتح ملف APK يدويًا من مجلد التنزيلات.';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'تعذر تثبيت التحديث تلقائيًا. افتح ملف APK يدويًا: ${apkFile.path}';
        });
      }
    }
  }
}
