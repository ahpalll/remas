import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/app_branding.dart';
import 'student_service.dart';

class BrandingService {
  FirebaseFirestore? get _db {
    try {
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  FirebaseAuth? get _auth {
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  Future<AppBranding> fetchAuthenticatedBranding() async {
    final user = _auth?.currentUser;
    if (user == null) {
      return AppBranding.platformDefault();
    }

    try {
      // 1. Resolve institutionId from active membership if available
      String? instId = StudentService().activeMembership?.institutionId;

      // 2. Resolve from user token claims
      if (instId == null || instId.isEmpty) {
        final tokenResult = await user.getIdTokenResult();
        instId = tokenResult.claims?['institutionId'] as String?;
      }

      // 3. Fallback: query student profile in Firestore
      final db = _db;
      if ((instId == null || instId.isEmpty) && db != null) {
        const knownInstitutions = [
          'rdYkP0iEoIz1HvcU3sel',
          'YOiA0CVF7kGNuwsqRgjk',
          'OIpycS1wngp53gqxDXla',
        ];
        for (final id in knownInstitutions) {
          try {
            final snap = await db
                .collection('institutions')
                .doc(id)
                .collection('students')
                .where('authUid', isEqualTo: user.uid)
                .limit(1)
                .get();
            if (snap.docs.isNotEmpty) {
              instId = id;
              break;
            }
          } catch (_) {}
        }
      }

      if (instId != null && instId.isNotEmpty && db != null) {
        final instDoc = await db.collection('institutions').doc(instId).get();
        if (instDoc.exists && instDoc.data() != null) {
          final data = instDoc.data()!;
          return AppBranding.fromJson(data, instId: instId);
        }
      }
    } catch (_) {
      return AppBranding.platformDefault();
    }

    return AppBranding.platformDefault();
  }
}
