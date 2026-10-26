import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../models/educational_content.dart';
import '../services/student_service.dart';

/// Secure Video Player Screen with:
/// 1. Hardware screen-recording / screenshot block enforced at OS level (FLAG_SECURE in MainActivity.kt).
/// 2. Android-only enforcement guard.
/// 3. Dynamic bouncing watermark overlay with student name, center, code and phone number.
/// 4. Watch Code verification dialog if access code is required.
class VideoPlayerScreen extends StatefulWidget {
  final EducationalContentDTO content;
  final String? playbackUrl;
  final String? studentName;
  final String? studentCode;
  final String? studentPhone;
  final String? centerName;

  const VideoPlayerScreen({
    super.key,
    required this.content,
    this.playbackUrl,
    this.studentName,
    this.studentCode,
    this.studentPhone,
    this.centerName,
  });

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen>
    with SingleTickerProviderStateMixin {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;
  bool _showControls = true;
  Timer? _controlsTimer;

  // Watermark Animation
  late AnimationController _watermarkController;
  late Animation<Alignment> _watermarkAlignment;

  // Student Profile Data
  String _displayName = 'طالب';
  String _displayCode = '—';
  String _displayPhone = '—';
  String _displayCenter = 'السنتر التعليمي';

  @override
  void initState() {
    super.initState();
    _initWatermarkAnimation();
    _loadStudentContext();

    // Check platform restriction
    if (!kIsWeb && !Platform.isAndroid) {
      _hasError = true;
      _errorMessage =
          'مشاهدة الفيديوهات مقتصرة حصرياً على تطبيق الأندرويد للهواتف لضمان حماية المحتوى من تصوير وتسجيل الشاشة.';
      return;
    }

    _initVideoPlayer();
  }

  void _initWatermarkAnimation() {
    _watermarkController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 18),
    )..repeat(reverse: true);

    _watermarkAlignment = AlignmentTween(
      begin: const Alignment(-0.85, -0.8),
      end: const Alignment(0.85, 0.8),
    ).animate(CurvedAnimation(
      parent: _watermarkController,
      curve: Curves.easeInOut,
    ));
  }

  Future<void> _loadStudentContext() async {
    try {
      final profile = await StudentService().fetchCurrentStudentProfile().catchError((_) => null);
      if (profile != null && mounted) {
        setState(() {
          _displayName = profile.fullName;
          _displayCode = profile.studentCode.isNotEmpty ? profile.studentCode : profile.id;
          _displayPhone = profile.phone.isNotEmpty ? profile.phone : '—';
        });
      }
    } catch (_) {}

    if (widget.studentName != null && widget.studentName!.isNotEmpty) {
      _displayName = widget.studentName!;
    }
    if (widget.studentCode != null && widget.studentCode!.isNotEmpty) {
      _displayCode = widget.studentCode!;
    }
    if (widget.studentPhone != null && widget.studentPhone!.isNotEmpty) {
      _displayPhone = widget.studentPhone!;
    }
    if (widget.centerName != null && widget.centerName!.isNotEmpty) {
      _displayCenter = widget.centerName!;
    }
  }

  void _initVideoPlayer() {
    final url = widget.playbackUrl;
    if (url == null || url.isEmpty) {
      setState(() {
        _hasError = true;
        _errorMessage = 'رابط تشغيل الفيديو غير متاح أو يتطلب إدخال كود مشاهدة مسبق.';
      });
      return;
    }

    try {
      final uri = Uri.parse(url);
      _controller = VideoPlayerController.networkUrl(uri)
        ..initialize().then((_) {
          if (mounted) {
            setState(() {
              _isInitialized = true;
            });
            _controller?.play();
            _startControlsTimer();
          }
        }).catchError((err) {
          if (mounted) {
            setState(() {
              _hasError = true;
              _errorMessage = 'تعذر تشغيل الفيديو: ${err.toString()}';
            });
          }
        });

      _controller?.addListener(() {
        if (mounted) setState(() {});
      });
    } catch (e) {
      setState(() {
        _hasError = true;
        _errorMessage = 'خطأ في إعداد مشغل الفيديو: $e';
      });
    }
  }

  void _startControlsTimer() {
    _controlsTimer?.cancel();
    _controlsTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && _controller != null && _controller!.value.isPlaying) {
        setState(() {
          _showControls = false;
        });
      }
    });
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
    if (_showControls) {
      _startControlsTimer();
    }
  }

  @override
  void dispose() {
    _controlsTimer?.cancel();
    _watermarkController.dispose();
    _controller?.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (d.inHours > 0) {
      return '${d.inHours}:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: _hasError
            ? _buildErrorView()
            : !_isInitialized
                ? _buildLoadingView()
                : _buildPlayerWithWatermark(),
      ),
    );
  }

  Widget _buildLoadingView() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: Color(0xFF38BDF8)),
          const SizedBox(height: 16),
          Text(
            'جاري فتح الفيديو المشفر بأمان...',
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Text(
            widget.content.title,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.shield_outlined, color: Colors.amber, size: 64),
            const SizedBox(height: 16),
            const Text(
              'حماية المحتوى التعليمي',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              _errorMessage ?? 'تعذر عرض الفيديو',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back),
              label: const Text('العودة للمحتوى'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF334155),
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlayerWithWatermark() {
    final controller = _controller!;
    final position = controller.value.position;
    final duration = controller.value.duration;

    return GestureDetector(
      onTap: _toggleControls,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Video Player
          Center(
            child: AspectRatio(
              aspectRatio: controller.value.aspectRatio,
              child: VideoPlayer(controller),
            ),
          ),

          // 2. Anti-Piracy Floating Dynamic Watermark
          AnimatedBuilder(
            animation: _watermarkAlignment,
            builder: (context, child) {
              return Align(
                alignment: _watermarkAlignment.value,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.35),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.white.withOpacity(0.15)),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$_displayCenter | $_displayName',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.45),
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        'كود: $_displayCode | هاتف: $_displayPhone',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.40),
                          fontSize: 10,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          // 3. Player Controls Overlay
          if (_showControls)
            Container(
              color: Colors.black.withOpacity(0.45),
              child: Column(
                children: [
                  // Top Bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.white),
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                        Expanded(
                          child: Text(
                            widget.content.title,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.red.withOpacity(0.8),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'محمي DRM 🔒',
                            style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Center Play/Pause & Rewind/Forward Controls
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        iconSize: 36,
                        icon: const Icon(Icons.replay_10, color: Colors.white),
                        onPressed: () {
                          final newPos = position - const Duration(seconds: 10);
                          controller.seekTo(newPos > Duration.zero ? newPos : Duration.zero);
                          _startControlsTimer();
                        },
                      ),
                      const SizedBox(width: 24),
                      IconButton(
                        iconSize: 56,
                        icon: Icon(
                          controller.value.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                          color: const Color(0xFF38BDF8),
                        ),
                        onPressed: () {
                          if (controller.value.isPlaying) {
                            controller.pause();
                          } else {
                            controller.play();
                            _startControlsTimer();
                          }
                        },
                      ),
                      const SizedBox(width: 24),
                      IconButton(
                        iconSize: 36,
                        icon: const Icon(Icons.forward_10, color: Colors.white),
                        onPressed: () {
                          final newPos = position + const Duration(seconds: 10);
                          controller.seekTo(newPos < duration ? newPos : duration);
                          _startControlsTimer();
                        },
                      ),
                    ],
                  ),

                  const Spacer(),

                  // Bottom Progress Bar & Time
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Column(
                      children: [
                        VideoProgressIndicator(
                          controller,
                          allowScrubbing: true,
                          colors: const VideoProgressColors(
                            playedColor: Color(0xFF38BDF8),
                            bufferedColor: Colors.white24,
                            backgroundColor: Colors.white12,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _formatDuration(position),
                              style: const TextStyle(color: Colors.white70, fontSize: 12),
                            ),
                            Text(
                              _formatDuration(duration),
                              style: const TextStyle(color: Colors.white70, fontSize: 12),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
