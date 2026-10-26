import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:youtube_explode_dart/youtube_explode_dart.dart';
import '../models/educational_content.dart';
import '../services/student_service.dart';

/// Secure Video Player Screen with:
/// 1. Hardware screen-recording / screenshot block enforced at OS level (FLAG_SECURE in MainActivity.kt).
/// 2. Android-only enforcement guard.
/// 3. Dynamic bouncing watermark overlay with student name, center, code and phone number.
/// 4. Native playback of both direct MP4/HLS streams AND YouTube links (youtu.be / youtube.com).
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
  YoutubeExplode? _ytExplode;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;
  String _loadingStatus = 'جاري فتح الفيديو المشفر بأمان...';
  String? _streamQualityLabel;
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

  /// Extracts 11-char YouTube video ID from any standard YouTube URL format.
  String? _extractYouTubeVideoId(String url) {
    final trimmed = url.trim();
    final patterns = [
      RegExp(r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})'),
      RegExp(r'[?&]v=([a-zA-Z0-9_-]{11})'),
    ];
    for (final reg in patterns) {
      final match = reg.firstMatch(trimmed);
      if (match != null && match.groupCount >= 1) {
        return match.group(1);
      }
    }
    return null;
  }

  Future<void> _initVideoPlayer() async {
    final rawUrl = widget.playbackUrl ?? widget.content.url;
    if (rawUrl == null || rawUrl.trim().isEmpty) {
      setState(() {
        _hasError = true;
        _errorMessage = 'رابط تشغيل الفيديو غير متاح أو يتطلب إدخال كود مشاهدة مسبق.';
      });
      return;
    }

    try {
      Uri playbackUri;
      final ytId = _extractYouTubeVideoId(rawUrl);

      if (ytId != null) {
        if (mounted) {
          setState(() {
            _loadingStatus = 'جاري تجهيز بث فيديو اليوتيوب المحمي (DRM)...';
          });
        }
        _ytExplode = YoutubeExplode();
        final manifest = await _ytExplode!.videos.streamsClient.getManifest(ytId);

        if (manifest.muxed.isNotEmpty) {
          final muxedList = manifest.muxed.sortByVideoQuality();
          final bestStream = muxedList.first;
          playbackUri = bestStream.url;
          _streamQualityLabel = 'YouTube ${bestStream.qualityLabel}';
        } else if (manifest.hls.isNotEmpty) {
          final hlsStream = manifest.hls.first;
          playbackUri = hlsStream.url;
          _streamQualityLabel = 'YouTube HLS';
        } else {
          throw Exception('لا يتوفر بث متوافق لهذا الفيديو على يوتيوب');
        }
      } else {
        playbackUri = Uri.parse(rawUrl.trim());
        _streamQualityLabel = 'بث مباشر محمي';
      }

      if (!mounted) return;

      _controller = VideoPlayerController.networkUrl(playbackUri);
      await _controller!.initialize();

      if (!mounted) return;
      setState(() {
        _isInitialized = true;
        _hasError = false;
      });
      await _controller!.play();
      _startControlsTimer();

      _controller!.addListener(() {
        if (mounted) setState(() {});
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _hasError = true;
        _errorMessage = 'تعذر تشغيل الفيديو: ${e.toString().replaceAll('Exception: ', '')}';
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
    _ytExplode?.close();
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
            _loadingStatus,
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              widget.content.title,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
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
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton.icon(
                  onPressed: () {
                    setState(() {
                      _hasError = false;
                      _isInitialized = false;
                    });
                    _initVideoPlayer();
                  },
                  icon: const Icon(Icons.refresh),
                  label: const Text('إعادة المحاولة'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
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
              aspectRatio: controller.value.aspectRatio > 0
                  ? controller.value.aspectRatio
                  : 16 / 9,
              child: VideoPlayer(controller),
            ),
          ),

          // 2. Anti-Piracy Floating Dynamic Watermark (IgnorePointer so it never blocks touches)
          IgnorePointer(
            child: AnimatedBuilder(
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
                        if (_streamQualityLabel != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0284C7).withOpacity(0.85),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              _streamQualityLabel!,
                              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
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
