# Architectural Decision Records (ADR)

## ADR-010: Phase 10 Exams & Grades Architecture & Score Precision Model

### Context
Exams and grade evaluation require structural immutability, correct-answer privacy protection, score precision, and auditability for grade revisions.

### Decision
1. **Exam Question Snapshots (`ExamQuestionSnapshot`)**: Publishing an exam creates immutable question snapshots. Historical exam contents and grades are derived strictly from snapshots, preserving stability even if live question banks are edited later.
2. **Correct-Answer Privacy Protection**: Correct answer fields (`isCorrect`, `correctAnswer`) are strictly administrative/trusted data. Firestore rules deny student and parent access to correct answers.
3. **Score Precision Policy (Integer Hundredths)**: All score and percentage fields are represented as non-negative safe integer hundredths ($100 = 1.00$ mark), eliminating floating-point rounding errors.
4. **Immutable Grade Revisions (`GradeRevision`)**: Grade corrections create append-only audit records storing previous score, new score, reason, actor, and timestamp. Casually overwriting finalized grades is prohibited.
5. **Deterministic Grade IDs**: Grade records use deterministic document IDs (`grade_{examId}_{studentId}`) to prevent duplicate grade records during concurrent submissions.
