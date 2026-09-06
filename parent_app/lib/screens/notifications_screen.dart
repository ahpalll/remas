import 'package:flutter/material.dart';

class ParentNotificationItem {
  final String id;
  final String childName;
  final String title;
  final String body;
  final String category;
  final bool isRead;
  final DateTime createdAt;

  ParentNotificationItem({
    required this.id,
    required this.childName,
    required this.title,
    required this.body,
    required this.category,
    required this.isRead,
    required this.createdAt,
  });
}

class ParentNotificationsScreen extends StatefulWidget {
  const ParentNotificationsScreen({super.key});

  @override
  State<ParentNotificationsScreen> createState() => _ParentNotificationsScreenState();
}

class _ParentNotificationsScreenState extends State<ParentNotificationsScreen> {
  final List<ParentNotificationItem> _notifications = [
    ParentNotificationItem(
      id: 'notif_p1',
      childName: 'محمد أحمد علي',
      title: 'إشعار نتيجة اختبار',
      body: 'تم نشر نتيجة اختبار الرياضيات للطالب محمد (48/50).',
      category: 'GRADE',
      isRead: false,
      createdAt: DateTime.now().subtract(const Duration(hours: 1)),
    ),
    ParentNotificationItem(
      id: 'notif_p2',
      childName: 'سارة أحمد علي',
      title: 'إشعار حضور الجلسة',
      body: 'تم تسجيل حضور الطالبة سارة في مادة الفيزياء.',
      category: 'ATTENDANCE',
      isRead: true,
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('إشعارات الأبناء'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: _notifications.isEmpty
          ? const Center(child: Text('لا توجد إشعارات للأبناء حالياً.'))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _notifications.length,
              itemBuilder: (context, index) {
                final item = _notifications[index];
                return Card(
                  elevation: item.isRead ? 1 : 3,
                  color: item.isRead ? Colors.white : Colors.indigo.shade50,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.indigo,
                      child: Text(item.childName.substring(0, 1), style: const TextStyle(color: Colors.white)),
                    ),
                    title: Text('${item.title} (${item.childName})', style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text(item.body),
                    trailing: Icon(
                      item.category == 'GRADE' ? Icons.grade : Icons.check_circle,
                      color: Colors.indigo,
                    ),
                  ),
                );
              },
            ),
    );
  }
}
