# Academic Calendar Contracts (Phase 1)

## 목적

학사일정 연동 개편의 1차 릴리스 기준 도메인 계약을 코드와 동일한 형태로 고정한다.

## 공통 원칙

- 내부 코드 모델은 camelCase를 사용한다.
- PRD의 snake_case 계약은 아래 매핑 표로 관리한다.
- `TimetableSnapshot`, `ChangeEvent` 확장 필드는 모두 required다.
- 트랜잭션 상태 전이는 `DRAFT -> COMMITTED | ROLLED_BACK`만 허용한다.

## 스네이크-카멜 매핑

| PRD (snake_case) | 코드 (camelCase) |
| --- | --- |
| `event_id` | `id` |
| `event_type` | `eventType` |
| `start_date` | `startDate` |
| `end_date` | `endDate` |
| `scope_type` | `scopeType` |
| `scope_value` | `scopeValue` |
| `period_override` | `periodOverride` |
| `week_tag` | `weekTag` |
| `version_no` | `versionNo` |
| `base_version_id` | `baseVersionId` |
| `applied_scope` | `appliedScope` |
| `from_week` | `fromWeek` |
| `to_week` | `toWeek` |
| `before_payload` | `beforePayload` |
| `after_payload` | `afterPayload` |
| `impact_summary` | `impactSummary` |
| `conflict_detected` | `conflictDetected` |
| `rollback_ref` | `rollbackRef` |
| `draft_id` | `draftId` |
| `target_weeks` | `targetWeeks` |
| `validation_result` | `validationResult` |
| `impact_report_id` | `impactReportId` |

## 핵심 계약

### AcademicCalendarEvent

- 이벤트 타입: `SEMESTER_START | SEMESTER_END | HOLIDAY | CLOSURE_DAY | EXAM_PERIOD | GRADE_EVENT | SCHOOL_EVENT | SHORTENED_DAY`
- 범위 타입: `SCHOOL | GRADE | CLASS`
- `SHORTENED_DAY`는 `periodOverride` 필수
- `SHORTENED_DAY` 외 타입은 `periodOverride` 금지

### TimetableSnapshot (확장)

- 필수 필드:
  - `weekTag: WeekTag`
  - `versionNo: number (>=1)`
  - `baseVersionId: string | null`
  - `appliedScope: { type, fromWeek, toWeek }`
- 적용 범위 타입:
  - `THIS_WEEK`
  - `FROM_NEXT_WEEK`
  - `RANGE`
- 스키마 규칙:
  - `RANGE`일 때 `toWeek` 필수
  - `RANGE`가 아니면 `toWeek`는 `null`

### ChangeEvent (확장)

- 감사 필드(필수):
  - `actor`
  - `beforePayload`
  - `afterPayload`
  - `impactSummary`
  - `conflictDetected`
  - `rollbackRef`
- 하위 호환 필드 유지:
  - `cellKey`
  - `before`
  - `after`

### ScheduleTransaction

- 상태: `DRAFT | COMMITTED | ROLLED_BACK`
- 전이 허용:
  - `DRAFT -> COMMITTED`
  - `DRAFT -> ROLLED_BACK`
- 전이 금지:
  - `COMMITTED -> *`
  - `ROLLED_BACK -> *`
  - `DRAFT -> DRAFT`
- 전이 금지 시 도메인 에러 코드: `INVALID_TRANSACTION_TRANSITION`

## v6 마이그레이션 기본값 정책

### Snapshot 기본값

- `weekTag`: `createdAt` 기준 ISO 주차 (파싱 실패 시 현재 주차)
- `versionNo`: `1`
- `baseVersionId`: `null`
- `appliedScope`: `{ type: 'THIS_WEEK', fromWeek: weekTag, toWeek: null }`

### ChangeEvent 기본값

- `actor`: `'LOCAL_OPERATOR'`
- `beforePayload`: `before ?? null`
- `afterPayload`: `after ?? null`
- `impactSummary`: `null`
- `conflictDetected`: `false`
- `rollbackRef`: `null`

## 저장소 API 확장

- 주차 스냅샷 조회:
  - `loadSnapshotsByWeek(weekTag)`
  - `loadSnapshotVersion(weekTag, versionNo)`
  - `loadLatestSnapshotByWeek(weekTag)`
- 학사일정:
  - `saveAcademicCalendarEvents(events)`
  - `loadAcademicCalendarEventsByRange(startDate, endDate)`
- 트랜잭션:
  - `saveScheduleTransaction(transaction)`
  - `updateScheduleTransaction(transaction)`
