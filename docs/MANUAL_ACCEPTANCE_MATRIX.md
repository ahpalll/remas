# REMAS EDU — Master Manual Acceptance Matrix

## 1. Status Policy & Acceptance Definitions

| Acceptance Status | Definition |
|:---|:---|
| `PENDING` | Default initial state. Awaiting physical manual product-owner testing. |
| `AUTOMATED_VERIFIED` | Unit, widget, or integration test passed in CI/test runner. |
| `RUNTIME_VERIFIED` | Live Firebase or emulator runtime verified by development subagent. |
| `USER_VERIFIED` | **Explicitly accepted by the product owner** after manual physical testing. |
| `BLOCKED` | Functional or security defect preventing manual testing. |

> [!IMPORTANT]
> - **Product Owner Acceptance Rule**: A screen status can ONLY be marked `USER_VERIFIED` after the product owner personally inspects and operates the screen on a physical runtime device or emulator.
> - **Current USER_VERIFIED Screen Count**: **0 (NONE)**.

---

## 2. SuperAdmin Mobile Control Center (`superadmin_app`)

| Test ID | Screen ID | Arabic Screen Name | Target Role | Automated / Runtime Status | Product Owner Acceptance Status |
|:---|:---|:---|:---|:---|:---|
| `TEST-SA-01` | `SA-001` | شاشة تسجيل دخول المدير العام | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-02` | `SA-002` | لوحة تحكم منصة ريماس التعليمية | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-03` | `SA-003` | شاشة إدارة السناتر التعليمية | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-04` | `SA-004` | معالج إضافة سنتر جديد (5 خطوات) | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-05` | `SA-005` | شاشة إدارة تراخيص التشغيل | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-06` | `SA-006` | شاشة ربط وتأمين أجهزة التشغيل | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-07` | `SA-007` | شاشة إدارة حسابات المنصة والأدوار | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-08` | `SA-008` | شاشة إعدادات الذكاء الاصطناعي والحصص | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-09` | `SA-009` | شاشة حالة وحجم النظام والبنية التحتية | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-10` | `SA-010` | شاشة تحليلات الاستهلاك والتخزين | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |
| `TEST-SA-11` | `SA-011` | شاشة سجلات الأمان والتدقيق | superAdmin | `AUTOMATED_VERIFIED` | `PENDING` |

---

## 3. Center Windows Desktop App (`center-desktop`)

| Test ID | Screen ID | Arabic Screen Name | Target Role | Automated / Runtime Status | Product Owner Acceptance Status |
|:---|:---|:---|:---|:---|:---|
| `TEST-CD-01` | `CD-001` | شاشة تسجيل دخول مالك السنتر | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-02` | `CD-002` | شاشة التحقق من الترخيص وربط الجهاز | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-03` | `CD-003` | لوحة تحكم السنتر الرئيسية | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-04` | `CD-004` | شاشة الهيكل الأكاديمي (السنوات، المراحل، المواد) | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-05` | `CD-005` | شاشة قائمة الطلاب والتصفية | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-06` | `CD-006` | نافذة إضافة / تعديل بيانات طالب | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-07` | `CD-007` | شاشة قائمة المعلمين والتخصصات | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-08` | `CD-008` | نافذة إضافة / تعديل بيانات معلم | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-09` | `CD-009` | شاشة إدارة المجموعات الدراسية والتسجيل | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-10` | `CD-010` | نافذة إنشاء / تعديل مجموعة دراسية | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-CD-11` | `CD-011` | شاشة جدول الحصص اليومية | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-12` | `CD-012` | نافذة إنشاء حصة جديدة | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-13` | `CD-013` | شاشة كشف حضور الحصة | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-14` | `CD-014` | كشك الاستقبال والمسح السريع للباركود | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-15` | `CD-015` | شاشة المحتوى التعليمي والدروس | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-16` | `CD-016` | نافذة رفع درس / فيديو / PDF | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-17` | `CD-017` | شاشة الواجبات والتكليفات | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-18` | `CD-018` | شاشة الامتحانات وبنك الأسئلة | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-19` | `CD-019` | نافذة إنشاء امتحان جديد | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-20` | `CD-020` | شاشة المالية والرسوم والتحصيل | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-21` | `CD-021` | نافذة تسجيل تحصيل / إيصال سداد | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-22` | `CD-022` | شاشة مستحقات المعلمين والنسب | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-23` | `CD-023` | شاشة الكتب والمخزن والمبيعات | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-24` | `CD-024` | نافذة عملية بيع / شراء كتاب | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-25` | `CD-025` | شاشة الإشعارات والإعلانات العامة | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-26` | `CD-026` | كونسول الذكاء الاصطناعي والمساعد | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-27` | `CD-027` | شاشة التقارير والإحصائيات الشاملة | institutionOwner | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-CD-28` | `CD-028` | شاشة إعدادات السنتر والهوية | institutionOwner | `RUNTIME_VERIFIED` | `PENDING` |

---

## 4. Student Android App (`student_app`)

| Test ID | Screen ID | Arabic Screen Name | Target Role | Automated / Runtime Status | Product Owner Acceptance Status |
|:---|:---|:---|:---|:---|:---|
| `TEST-ST-01` | `ST-001` | شاشة الترحيب والبداية | student | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-ST-02` | `ST-002` | شاشة تسجيل الدخول برقم الهاتف و OTP | student | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-ST-03` | `ST-003` | شاشة اختيار السنتر / المركز | student | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-ST-04` | `ST-004` | لوحة تحكم الطالب الرئيسية | student | `RUNTIME_VERIFIED` | `PENDING` |
| `TEST-ST-05` | `ST-005` | شاشة جدول الحصص الأسبوعي | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-06` | `ST-006` | شاشة سجل الحضور والغياب | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-07` | `ST-007` | شاشة الدروس والملفات والـ PDF | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-08` | `ST-008` | شاشة مشغل الفيديوهات التعليمية | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-09` | `ST-009` | شاشة الواجبات وتسليم التكليفات | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-10` | `ST-010` | شاشة قائمة الامتحانات الإلكترونية | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-11` | `ST-011` | شاشة أداء الامتحان الإلكتروني | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-12` | `ST-012` | شاشة الدرجات ونتائج الاختبارات | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-13` | `ST-013` | شاشة كروت الاشتراك والتعليم | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-14` | `ST-014` | شاشة الإشعارات وتنبيهات السنتر | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-15` | `ST-015` | شاشة المعلم الذكي وتعيين المادة | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-16` | `ST-016` | شاشة المحادثة مع المعلم الذكي | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-17` | `ST-017` | شاشة الشرح التفاعلي للدروس | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-18` | `ST-018` | شاشة الاختبارات الذاتية بالذكاء الاصطناعي | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-19` | `ST-019` | شاشة تحليل النقاط الضعيفة | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-20` | `ST-020` | شاشة الخطة الدراسية الشخصية | student | `IMPLEMENTED_NOT_TESTED` | `PENDING` |
| `TEST-ST-21` | `ST-021` | شاشة الملف الشخصي للطالب | student | `RUNTIME_VERIFIED` | `PENDING` |

---

## 5. Summary Baseline

- Total System Screens: **88 Unique Screens**
- `AUTOMATED_VERIFIED` Screens: **11**
- `RUNTIME_VERIFIED` Screens: **14**
- `IMPLEMENTED_NOT_TESTED` Screens: **63**
- `USER_VERIFIED` Screens: **0 (NONE)**
