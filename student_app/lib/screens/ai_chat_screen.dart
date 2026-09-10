import 'package:flutter/material.dart';
import '../models/ai_models.dart';
import '../services/ai_tutor_service.dart';

/// Interactive Arabic RTL AI Chat Screen
class AIChatScreen extends StatefulWidget {
  final StudentAITutorService aiService;
  final String? initialPrompt;
  final String? initialLessonId;
  final String? initialLessonTitle;

  const AIChatScreen({
    super.key,
    required this.aiService,
    this.initialPrompt,
    this.initialLessonId,
    this.initialLessonTitle,
  });

  @override
  State<AIChatScreen> createState() => _AIChatScreenState();
}

class _AIChatScreenState extends State<AIChatScreen> {
  final List<AIChatMessageDTO> _messages = [];
  final TextEditingController _inputController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
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
              child: Row(
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
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(AIChatMessageDTO msg) {
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
          ],
        ),
      ),
    );
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    final userMsg = AIChatMessageDTO(
      id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
      text: text.trim(),
      isUser: true,
      timestamp: DateTime.now(),
    );

    setState(() {
      _messages.add(userMsg);
      _isLoading = true;
    });
    _inputController.clear();

    final res = await widget.aiService.askQuestion(
      prompt: text,
      lessonId: widget.initialLessonId,
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
        _messages.add(
          AIChatMessageDTO(
            id: 'msg_err_${DateTime.now().millisecondsSinceEpoch}',
            text: res['message'] ?? 'حدث خطأ في الاتصال بالمساعد الذكي.',
            isUser: false,
            timestamp: DateTime.now(),
          ),
        );
      }
    });
  }
}
