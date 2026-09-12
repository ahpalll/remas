import 'package:flutter/material';

class SystemHealthScreen extends StatelessWidget {
  const SystemHealthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final List<Map<String, String>> services = [
      {'name': 'Firebase Authentication', 'status': 'سليم 🟢', 'latency': '42 ms'},
      {'name': 'Cloud Firestore Database', 'status': 'سليم 🟢', 'latency': '28 ms'},
      {'name': 'Licensing Backend Service', 'status': 'سليم 🟢', 'latency': '35 ms'},
      {'name': 'Cloudflare R2 Gateway', 'status': 'سليم 🟢', 'latency': '65 ms'},
      {'name': 'Google Gemini AI', 'status': 'سليم 🟢', 'latency': '120 ms'},
      {'name': 'OpenRouter AI Fallback', 'status': 'سليم 🟢', 'latency': '180 ms'},
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🏥 سلامة النظام والخدمات السحابية', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Expanded(
              child: ListView.builder(
                itemCount: services.length,
                itemBuilder: (context, index) {
                  final s = services[index];
                  return Card(
                    color: const Color(0xFF1E293B),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text(s['name']!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      subtitle: Text('زمن الاستجابة: ${s['latency']}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      trailing: Text(s['status']!, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
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
