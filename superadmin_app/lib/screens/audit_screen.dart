import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// REAL audit screen: reads the authoritative `auditLogs` collection
/// (append-only, SuperAdmin-readable). Empty collection = empty state,
/// never invented rows.
class AuditScreen extends StatefulWidget {
  const AuditScreen({super.key});

  @override
  State<AuditScreen> createState() => _AuditScreenState();
}

class _AuditScreenState extends State<AuditScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _logs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final snap = await FirebaseFirestore.instance
          .collection('auditLogs')
          .orderBy('createdAt', descending: true)
          .limit(50)
          .get()
          .timeout(const Duration(seconds: 15), onTimeout: () {
        throw Exception('TIMEOUT: تعذر قراءة سجل التدقيق (انتهت المهلة)');
      });
      if (mounted) {
        setState(() {
          _logs = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('📜 سجل النشاطات والأمان (REAL — من Firestore)',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (_loading)
              const Expanded(child: Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8))))
            else if (_error != null)
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('تعذر قراءة السجل: $_error',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _load, child: const Text('إعادة المحاولة')),
                    ],
                  ),
                ),
              )
            else if (_logs.isEmpty)
              const Expanded(
                child: Center(
                  child: Text('لا توجد سجلات تدقيق بعد في Firestore (REAL — فارغ، لا بيانات مخترعة).',
                      textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF94A3B8))),
                ),
              )
            else
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: _logs.length,
                    itemBuilder: (context, index) {
                      final log = _logs[index];
                      final action = (log['action'] ?? log['eventType'] ?? 'UNKNOWN').toString();
                      final actor = (log['actorUid'] ?? log['actor'] ?? log['actorId'] ?? '—').toString();
                      final target = (log['institutionId'] ?? log['target'] ?? '—').toString();
                      final time = (log['createdAt'] ?? log['timestamp'] ?? log['time'] ?? '—').toString();
                      final status = (log['status'] ?? log['result'] ?? '—').toString();
                      final isSuccess = status == 'SUCCESS';
                      return Card(
                        color: const Color(0xFF1E293B),
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(14.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(action,
                                        style: const TextStyle(
                                            color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                  ),
                                  Chip(
                                    label: Text(status),
                                    backgroundColor:
                                        isSuccess ? const Color(0xFF166534) : const Color(0xFF991B1B),
                                    labelStyle: const TextStyle(color: Colors.white, fontSize: 10),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text('المنفّذ: $actor', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                              Text('المستهدف: $target', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                              Text('الوقت: $time', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
