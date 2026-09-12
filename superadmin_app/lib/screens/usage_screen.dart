import 'package:flutter/material.dart';

class UsageScreen extends StatelessWidget {
  const UsageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final List<Map<String, String>> metrics = [
      {'name': 'قراءات Firestore', 'value': '142,500', 'unit': 'عملية/يوم', 'status': 'مستقر 🟢'},
      {'name': 'كتابات Firestore', 'value': '18,400', 'unit': 'عملية/يوم', 'status': 'مستقر 🟢'},
      {'name': 'وسائط Cloudflare R2', 'value': '128.4', 'unit': 'GB', 'status': 'متوسط 🟡'},
      {'name': 'طلبات Cloudflare Worker', 'value': '64,200', 'unit': 'طلب/يوم', 'status': 'مستقر 🟢'},
      {'name': 'إشعارات FCM الفورية', 'value': '12,800', 'unit': 'إشعار/يوم', 'status': 'مستقر 🟢'},
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('📈 استهلاك موارد المنصة (Telemetry)', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Expanded(
              child: ListView.builder(
                itemCount: metrics.length,
                itemBuilder: (context, index) {
                  final item = metrics[index];
                  return Card(
                    color: const Color(0xFF1E293B),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text(item['name']!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      subtitle: Text('${item['value']} ${item['unit']}', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 16, fontWeight: FontWeight.bold)),
                      trailing: Text(item['status']!, style: const TextStyle(color: Colors.white, fontSize: 12)),
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
