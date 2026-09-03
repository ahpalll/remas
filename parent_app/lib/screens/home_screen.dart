import 'package:flutter/material.dart';
import '../models/parent_child.dart';
import '../services/parent_auth_service.dart';
import '../services/parent_data_service.dart';
import 'child_profile_screen.dart';
import 'child_groups_screen.dart';
import 'child_schedule_screen.dart';
import 'child_attendance_screen.dart';
import 'child_grades_screen.dart';
import 'child_content_screen.dart';

class HomeScreen extends StatefulWidget {
  final ParentAuthService authService;
  final ParentDataService dataService;
  const HomeScreen({super.key, required this.authService, required this.dataService});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<ParentChildDTO> _children = [];
  int _selectedChildIndex = 0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final list = await widget.dataService.fetchChildren();
    if (mounted) {
      setState(() {
        _children = list;
        _isLoading = false;
      });
    }
  }

  ParentChildDTO? get _currentChild => _children.isNotEmpty ? _children[_selectedChildIndex] : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('بوابة ولي الأمر — الرئيسية'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => widget.authService.logout(),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Card(
                    color: Colors.indigo.shade50,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          const CircleAvatar(
                            radius: 28,
                            backgroundColor: Colors.indigo,
                            child: Icon(Icons.family_restroom, color: Colors.white, size: 30),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.authService.currentUser?.fullName ?? 'مرحباً ولي الأمر',
                                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  'عدد الأبناء المسجلين: ${_children.length}',
                                  style: const TextStyle(color: Colors.grey),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (_children.isNotEmpty) ...[
                    const Text('اختر الابن:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 48,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _children.length,
                        itemBuilder: (context, index) {
                          final isSelected = index == _selectedChildIndex;
                          return Padding(
                            padding: const EdgeInsets.only(left: 8.0),
                            child: ChoiceChip(
                              label: Text(_children[index].fullName),
                              selected: isSelected,
                              selectedColor: Colors.indigo,
                              labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.black),
                              onSelected: (val) {
                                if (val) setState(() => _selectedChildIndex = index);
                              },
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                  const Text('خدمات الطالب المحدد:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.3,
                    children: [
                      _buildTile(
                        context,
                        title: 'الملف الشخصي',
                        icon: Icons.person,
                        color: Colors.blue,
                        onTap: () {
                          if (_currentChild != null) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => ChildProfileScreen(child: _currentChild!)));
                          }
                        },
                      ),
                      _buildTile(
                        context,
                        title: 'المجموعات والمواد',
                        icon: Icons.class_,
                        color: Colors.orange,
                        onTap: () {
                          if (_currentChild != null) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => ChildGroupsScreen(dataService: widget.dataService, childId: _currentChild!.id)));
                          }
                        },
                      ),
                      _buildTile(
                        context,
                        title: 'الجدول الزمني',
                        icon: Icons.schedule,
                        color: Colors.purple,
                        onTap: () {
                          if (_currentChild != null) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => ChildScheduleScreen(dataService: widget.dataService, childId: _currentChild!.id)));
                          }
                        },
                      ),
                      _buildTile(
                        context,
                        title: 'سجل الحضور',
                        icon: Icons.check_circle,
                        color: Colors.green,
                        onTap: () {
                          if (_currentChild != null) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => ChildAttendanceScreen(dataService: widget.dataService, childId: _currentChild!.id)));
                          }
                        },
                      ),
                      _buildTile(
                        context,
                        title: 'الدرجات والنتائج',
                        icon: Icons.grade,
                        color: Colors.deepOrange,
                        onTap: () {
                          if (_currentChild != null) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => ChildGradesScreen(dataService: widget.dataService, childId: _currentChild!.id)));
                          }
                        },
                      ),
                      _buildTile(
                        context,
                        title: 'المحتوى والاشتراكات',
                        icon: Icons.video_library,
                        color: Colors.teal,
                        onTap: () {
                          if (_currentChild != null) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => ChildContentScreen(dataService: widget.dataService, childId: _currentChild!.id)));
                          }
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildTile(BuildContext context, {required String title, required IconData icon, required Color color, required VoidCallback onTap}) {
    return Card(
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                backgroundColor: color.withAlpha(38),
                child: Icon(icon, color: color),
              ),
              const SizedBox(height: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14), textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
