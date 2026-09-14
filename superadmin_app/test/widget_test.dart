import 'package:flutter_test/flutter_test.dart';
import 'package:superadmin_app/main.dart';

void main() {
  testWidgets('SuperAdminApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const SuperAdminApp());
    expect(find.byType(SuperAdminApp), findsOneWidget);
  });
}
