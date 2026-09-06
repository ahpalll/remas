import 'package:flutter/material.dart';

class StudentNotificationItem {
  final String id;
  final String title;
  final String body;
  final String category;
  final bool isRead;
  final DateTime createdAt;
  final String? targetScreen;

  StudentNotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    required this.isRead,
    required this.createdAt,
    this.targetScreen,
  });
}

class StudentNotificationsScreen extends StatefulWidget {
  const StudentNotificationsScreen({super.key});

  @override
  State<StudentNotificationsScreen> createState() => _StudentNotificationsScreenState();
}

class _StudentNotificationsScreenState extends State<StudentNotificationsScreen> {
  final List<StudentNotificationItem> _notifications = [
    StudentNotificationItem(
      id: 'notif_1',
      title: 'تم نشر نتيجة اختبار الرياضيات البحتة',
      body: 'حصلت على 48 من 50 (96%) في الاختبار النصف سنوي.',
      category: 'GRADE',
      isRead: false,
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
      targetScreen: 'GradesScreen',
    ),
    StudentNotificationItem(
      id: 'notif_2',
      title: 'تأكيد تسجيل الحضور',
      body: 'تم تسجيل حضورك في حصة الفيزياء الحديثة اليوم.',
      category: 'ATTENDANCE',
      isRead: true,
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
      targetScreen: 'AttendanceScreen',
    ),
    StudentNotificationItem(
      id: 'notif_3',
      title: 'درس تعليمي جديد منشور',
      body: 'تم إضافة ملخص الجبر والمصفوفات بصيغة PDF.',
      category: 'CONTENT',
      isRead: true,
      createdAt: DateTime.now().subtract(const Duration(days: 3)),
      targetScreen: 'EducationalContentScreen',
    ),
  ];

  void _markAsRead(int index) {
    setState(() {
      _notifications[index] = StudentNotificationItem(
        id: _notifications[index].id,
        title: _notifications[index].title,
        body: _notifications[index].body,
        category: _notifications[index].category,
        isRead: true,
        createdAt: _notifications[index].createdAt,
        targetScreen: _notifications[index].targetScreen,
      );
    });
  }

  IconData _getCategoryIcon(String category) {
    switch (category) {
      case 'GRADE':
        return Icons.grade;
      case 'ATTENDANCE':
        return Icons.check_circle;
      case 'CONTENT':
        return Icons.video_library;
      case 'EXAM':
      case 'ONLINE_EXAM':
        return Icons.assignment;
      case 'SUBSCRIPTION':
        return Icons.verified;
      default:
        return Icons.notifications;
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => !n.isRead).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('الإشعارات والتنبيهات'),
        actions: [
          if (unreadCount > 0)
            TextButton.icon(
              onPressed: () {
                setState(() {
                  for (int i = 0; i < _notifications.length; i++) {
                    _markAsRead(i);
                  }
                });
              },
              icon: const Icon(Icons.done_all, color: Colors.white, size: 18),
              label: const Text('تحديد الكل كُمقروء', style: TextStyle(color: Colors.white, fontSize: 12)),
            ),
        ],
      ),
      body: _notifications.isEmpty
          ? const Center(child: Text('لا توجد إشعارات حالياً.'))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _notifications.length,
              itemBuilder: (context, index) {
                final item = _notifications[index];
                return Card(
                  elevation: item.isRead ? 1 : 3,
                  color: item.isRead ? Colors.white : Colors.deepPurple.shade50,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: item.isRead ? Colors.grey.shade200 : Colors.deepPurple,
                      child: Icon(_getCategoryIcon(item.category), color: item.isRead ? Colors.grey : Colors.white),
                    ),
                    title: Text(item.title, style: TextStyle(fontWeight: item.isRead ? FontWeight.normal : FontWeight.bold)),
                    subtitle: Text(item.body),
                    trailing: item.isRead
                        ? const Icon(Icons.check, size: 16, color: Colors.grey)
                        : Container(
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(color: Colors.deepPurple, shape: BoxShape.circle),
                          ),
                    onTap: () => _markAsRead(index),
                  ),
                );
              },
            ),
    );
  }
}
