import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/app_branding.dart';

class TeacherBrandingService {
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
      final tokenResult = await user.getIdTokenResult();
      final instId = tokenResult.claims?['institutionId'] as String?;

      if (instId == null || instId.isEmpty) {
        return AppBranding.platformDefault();
      }

      final db = _db;
      if (db == null) {
        return AppBranding.platformDefault();
      }

      final instDoc = await db.collection('institutions').doc(instId).get();
      if (instDoc.exists && instDoc.data() != null) {
        final data = instDoc.data()!;
        if (data.containsKey('branding') && data['branding'] is Map) {
          return AppBranding.fromJson(data, instId: instId);
        }
      }
    } catch (_) {
      return AppBranding.platformDefault();
    }

    return AppBranding.platformDefault();
  }
}
