import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/main.dart';

void main() {
  testWidgets('StudentApp smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const StudentApp());

    // Verify app renders
    expect(find.byType(StudentApp), findsOneWidget);
  });
}
