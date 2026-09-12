import 'package:flutter/material';

class AuditScreen extends StatelessWidget {
  const AuditScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final List<Map<String, String>> logs = [
      {'action': 'LICENSE_RENEWED', 'actor': 'sa_admin@remas.edu', 'time': 'منذ 10 دقائق', 'target': 'inst_bootstrap_001', 'status': 'SUCCESS'},
      {'action': 'DEVICE_UNBOUND', 'actor': 'sa_admin@remas.edu', 'time': 'منذ ساعتين', 'target': 'inst_cairo_center', 'status': 'SUCCESS'},
      {'action': 'ACTIVATION_FAILED', 'actor': 'owner_cairo@remas.edu', 'time': 'منذ 5 ساعات', 'target': 'inst_cairo_center', 'status': 'DENIED'},
      {'action': 'LICENSE_SUSPENDED', 'actor': 'sa_admin@remas.edu', 'time': 'منذ يوم', 'target': 'inst_alex_center', 'status': 'SUCCESS'},
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('📜 سجل النشاطات والأمان (Audit Log)', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Expanded(
              child: ListView.builder(
                itemCount: logs.length,
                itemBuilder: (context, index) {
                  final log = logs[index];
                  final isSuccess = log['status'] == 'SUCCESS';
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
                              Text(log['action']!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                              Chip(
                                label: Text(log['status']!),
                                backgroundColor: isSuccess ? const Color(0xFF166534) : const Color(0xFF991B1B),
                                labelStyle: const TextStyle(color: Colors.white, fontSize: 10),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text('المنفّذ: ${log['actor']}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                          Text('المستهدف: ${log['target']}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                          Text('الوقت: ${log['time']}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                        ],
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
