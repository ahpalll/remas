import 'package:flutter_test/flutter_test.dart';
import 'package:teacher_app/main.dart';

void main() {
  testWidgets('TeacherApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TeacherApp());
    expect(find.byType(TeacherApp), findsOneWidget);
  });
}
