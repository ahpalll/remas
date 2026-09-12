import 'package:flutter/material';

class AIControlScreen extends StatelessWidget {
  const AIControlScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🤖 مركز التحكم بالذكاء الاصطناعي (AI Gateway)', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('المزود الرئيسي (Primary Provider): Google Gemini 1.5 Pro', style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
                  SizedBox(height: 6),
                  Text('المزود الاحتياطي (Fallback Provider): OpenRouter (Claude / Llama3)', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                  SizedBox(height: 6),
                  Text('الحالة التشغيلية: مفعّل ويعمل بكفاءة 100%', style: TextStyle(color: Color(0xFF4ADE80), fontSize: 13)),
                  SizedBox(height: 12),
                  Text('🔐 أمان المفاتيح: المفاتيح مخزنة في بيئة سحابية مشفرة بـ Cloud KMS ولا توجد مفاتيح في تطبيق الموبايل.', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11)),
                ],
              ),
            ),
            const SizedBox(height: 16),

            const Text('📊 إحصائيات الاستهلاك والتكلفة', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Card(
              color: const Color(0xFF1E293B),
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('استدعاءات هذا الشهر:', style: TextStyle(color: Colors.white)), Text('8,420 طلب', style: TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold))]),
                    Divider(color: Color(0xFF334155)),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('التكلفة التقديرية:', style: TextStyle(color: Colors.white)), Text('\$12.45', style: TextStyle(color: Color(0xFF4ADE80), fontWeight: FontWeight.bold))]),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
