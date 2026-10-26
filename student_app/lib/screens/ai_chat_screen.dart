import 'package:flutter/material.dart';
import '../models/ai_models.dart';
import '../models/ai_learning_modes.dart';
import '../services/ai_tutor_service.dart';

/// Interactive Arabic RTL AI Chat Screen
class AIChatScreen extends StatefulWidget {
  final StudentAITutorService aiService;
  final String? initialPrompt;
  final String? initialLessonId;
  final String? initialLessonTitle;
  final String? initialMode;

  const AIChatScreen({
    super.key,
    required this.aiService,
    this.initialPrompt,
    this.initialLessonId,
    this.initialLessonTitle,
    this.initialMode,
  });

  @override
  State<AIChatScreen> createState() => _AIChatScreenState();
}

class _AIChatScreenState extends State<AIChatScreen> {
  final List<AIChatMessageDTO> _messages = [];
  final TextEditingController _inputController = TextEditingController();
  bool _isLoading = false;
  List<TutorSubjectDTO> _subjects = [];
  String? _selectedSubjectId;
  bool _subjectsLoading = true;
  String? _subjectsError;
  // AI-6: learning modes backed by existing server TUTOR_MODES (no new
  // endpoints). Default EXPLAIN preserves prior behavior.
  String _mode = 'EXPLAIN';
  static const Map<String, String> _modes = AiLearningModes.chatModes;
  // AI-7 F-S3: last failed action eligible for idempotent retry (same
  // requestId is reused so the server replays instead of double-charging).
  Map<String, String>? _pendingRetry;

  @override
  void initState() {
    super.initState();
    if (widget.initialMode != null &&
        _modes.containsKey(widget.initialMode)) {
      _mode = widget.initialMode!;
    }
    _loadSubjects();
    // Welcome message
    _messages.add(
      AIChatMessageDTO(
        id: 'msg_welcome',
        text: widget.initialLessonTitle != null
            ? 'مرحباً! أنا جاهز للإجابة عن أي سؤال يخص: (${widget.initialLessonTitle}). تفضل بطرح سؤالك.'
            : 'مرحباً بك! أنا مساعدك التعليمي في منصة ريماس. اكتب سؤالك وستحصل على إجابة مشروحة خطوة بخطوة.',
        isUser: false,
        timestamp: DateTime.now(),
        lessonId: widget.initialLessonId,
      ),
    );

    if (widget.initialPrompt != null) {
      _sendMessage(widget.initialPrompt!);
    }
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
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.initialLessonTitle ?? 'محادثة المساعد الذكي'),
          actions: [
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () {
                setState(() {
                  _messages.clear();
                });
              },
            ),
          ],
        ),
        body: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
              color: Colors.deepPurple.shade50,
              child: _subjectsLoading
                  ? const Row(
                      children: [
                        SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2)),
                        SizedBox(width: 8),
                        Text('جاري تحميل موادك الدراسية...',
                            style: TextStyle(fontSize: 12)),
                      ],
                    )
                  : _subjectsError != null
                      ? Row(
                          children: [
                            const Icon(Icons.error_outline,
                                size: 16, color: Colors.red),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(_subjectsError!,
                                  style: const TextStyle(
                                      fontSize: 12, color: Colors.red)),
                            ),
                            TextButton(
                              onPressed: _loadSubjects,
                              child: const Text('إعادة المحاولة',
                                  style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        )
                      : _subjects.isEmpty
                          ? const Text(
                              'لا توجد مواد متاحة لحسابك حاليًا.',
                              style: TextStyle(fontSize: 12),
                            )
                          : DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _selectedSubjectId,
                                hint: const Text('اختر المادة الدراسية',
                                    style: TextStyle(fontSize: 13)),
                                isExpanded: true,
                                items: _subjects
                                    .map((s) => DropdownMenuItem(
                                          value: s.subjectId,
                                          child: Text(s.name,
                                              style: const TextStyle(
                                                  fontSize: 13)),
                                        ))
                                    .toList(),
                                onChanged: (v) => setState(
                                    () => _selectedSubjectId = v),
                              ),
                            ),
            ),
            if (widget.initialLessonTitle != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                color: Colors.deepPurple.shade50,
                child: Row(
                  children: [
                    const Icon(Icons.school, size: 18, color: Colors.deepPurple),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'السياق المحدد: ${widget.initialLessonTitle}',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.deepPurple),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final msg = _messages[index];
                  return _buildMessageBubble(msg);
                },
              ),
            ),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 8),
                    Text('المساعد الذكي يفكر ويستخرج الشرح...'),
                  ],
                ),
              ),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4)],
              ),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: DropdownButtonFormField<String>(
                      value: _mode,
                      decoration: const InputDecoration(
                        labelText: 'نمط التعلم',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                      ),
                      items: _modes.entries
                          .map((e) => DropdownMenuItem(
                              value: e.key, child: Text(e.value)))
                          .toList(),
                      onChanged: (v) =>
                          setState(() => _mode = v ?? 'EXPLAIN'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _inputController,
                          decoration: const InputDecoration(
                            hintText: 'اكتب سؤالك هنا...',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                          onSubmitted: (val) => _sendMessage(val),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        onPressed: _isLoading ? null : () => _sendMessage(_inputController.text),
                        icon: const Icon(Icons.send),
                        style: IconButton.styleFrom(backgroundColor: Colors.deepPurple.shade800),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(AIChatMessageDTO msg) {
    final isPendingRetry = _pendingRetry != null &&
        _pendingRetry!['errorBubbleId'] == msg.id &&
        !_isLoading;
    return Align(
      alignment: msg.isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        decoration: BoxDecoration(
          color: msg.isUser ? Colors.indigo.shade800 : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              msg.text,
              style: TextStyle(
                color: msg.isUser ? Colors.white : Colors.black87,
                fontSize: 14,
              ),
            ),
            if (msg.sources != null && msg.sources!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'المصادر المعتمدة: ${msg.sources!.join('، ')}',
                style: TextStyle(fontSize: 11, color: msg.isUser ? Colors.white70 : Colors.indigo.shade800),
              ),
            ],
            if (isPendingRetry) ...[
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () => _retryPending(),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('إعادة المحاولة بنفس الطلب',
                    style: TextStyle(fontSize: 12)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _retryPending() async {
    final pending = _pendingRetry;
    if (pending == null || _isLoading) return;
    setState(() => _pendingRetry = null);
    await _sendMessage(pending['prompt']!, requestId: pending['requestId']);
  }

  Future<void> _sendMessage(String text, {String? requestId}) async {
    if (text.trim().isEmpty) return;

    final userMsg = AIChatMessageDTO(
      id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
      text: text.trim(),
      isUser: true,
      timestamp: DateTime.now(),
    );
    // One stable request id per user action (reused on retry).
    final actionRequestId =
        requestId ?? StudentAITutorService.generateRequestId();

    setState(() {
      _messages.add(userMsg);
      _isLoading = true;
    });
    _inputController.clear();

    final res = await widget.aiService.askQuestion(
      prompt: text,
      subjectId: _selectedSubjectId,
      lessonId: widget.initialLessonId,
      mode: _mode,
      requestId: actionRequestId,
    );

    setState(() {
      _isLoading = false;
      if (res['success'] == true) {
        _messages.add(
          AIChatMessageDTO(
            id: 'msg_res_${DateTime.now().millisecondsSinceEpoch}',
            text: res['response'] ?? '',
            isUser: false,
            timestamp: DateTime.now(),
            sources: res['sources'] != null ? List<String>.from(res['sources']) : null,
          ),
        );
      } else {
        final errId = 'msg_err_${DateTime.now().millisecondsSinceEpoch}';
        _messages.add(
          AIChatMessageDTO(
            id: errId,
            text: res['message'] ?? 'حدث خطأ في الاتصال بالمساعد الذكي.',
            isUser: false,
            timestamp: DateTime.now(),
          ),
        );
        // Retryable transport/provider failures keep the same request id;
        // auth/selection/validation errors must be fixed by the user first.
        final code = (res['errorCode'] ?? '').toString();
        if (code == 'NETWORK_ERROR' || code == 'PROVIDER_ERROR') {
          _pendingRetry = {
            'prompt': text.trim(),
            'requestId': actionRequestId,
            'errorBubbleId': errId,
          };
        }
      }
    });
  }
}
