import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/main.dart';

void main() {
  testWidgets('ParentApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ParentApp());
    expect(find.byType(ParentApp), findsOneWidget);
  });
}
