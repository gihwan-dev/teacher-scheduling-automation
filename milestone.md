# 프로젝트 개발 마일스톤 (파일 SSOT 기반 Setup Import + Autosave)

> 기반 문서: `/Users/choegihwan/Documents/Projects/scheduling-automation/plan.md`
> 실행 라벨: `[SEQUENTIAL]`, `[PARALLEL:PG-n]`
> 병렬 원칙: 읽기/테스트 병렬 허용, 코드 쓰기 충돌 가능 구간은 단일 writer로 순차 진행

## 병렬 그룹 요약
- `PG-1`: 파서 구현 2개 트랙 병렬 (`.xls`, `.xlsx`)
- `PG-2`: 검증/리포트 테스트와 UI 마감 점검 병렬

---

## Phase 1. [SEQUENTIAL] 문서/계약 전면 교체
- Owner Role: orchestrator
- Write Scope: `plan.md`, `milestone.md`, `src/features/manage-school-setup/model/**`(계약 타입 정의)
- Depends On: none
- [x] **신규 요구사항 기준 문서 확정**
  - 목표: 기존 계획 문서를 제거하고 SSOT/자동저장 기준으로 재작성
  - 검증: plan/milestone 내 미결정 사항 0건
- [x] **Import/Autosave 공용 타입 계약 확정**
  - 목표: `ImportIssue`, `ImportReport`, payload 타입 정의
  - 검증: 이후 Phase에서 타입 재해석 없이 구현 가능

## Phase 2. [PARALLEL:PG-1] 교사 시수표 `.xls` 파서 구현
- Owner Role: implementer
- Write Scope: `src/features/manage-school-setup/model/teacher-hours-xls-parser.ts`, 관련 타입/테스트 파일
- Depends On: Phase 1
- [ ] **템플릿 헤더/구조 검증 구현**
  - 목표: `교사별시수표` + 필수 헤더 + 학년/반 컬럼 구조 강제
  - 검증: 헤더 불일치 시 blocking error
- [ ] **정규화 payload 생성 구현**
  - 목표: `subjects`, `teachers`, `assignments`로 변환
  - 검증: 샘플 파일 기준 시수 합계/배정 일관성 확보
- [ ] **파서 단위 테스트 작성**
  - 목표: 정상/헤더오류/행 스킵 시나리오 보장
  - 검증: parser test 전체 통과

## Phase 3. [PARALLEL:PG-1] 최종 시간표 `.xlsx` 파서 구현
- Owner Role: implementer
- Write Scope: `src/features/manage-school-setup/model/final-timetable-xlsx-parser.ts`, 관련 타입/테스트 파일
- Depends On: Phase 1
- [ ] **클래스+교사 영역 동시 파싱 구현**
  - 목표: `1학기 시간표` 시트에서 슬롯/교사/과목 정보 추출
  - 검증: 샘플 파일 기준 슬롯 누락 없이 payload 생성
- [ ] **충돌 판정 규칙 구현**
  - 목표: 다중 교사/매칭 불능/헤더 누락을 blocking error 처리
  - 검증: 충돌 fixture에서 전체 반영 중단 확인
- [ ] **파서 단위 테스트 작성**
  - 목표: 정상/충돌/헤더오류 시나리오 보장
  - 검증: parser test 전체 통과

## Phase 4. [SEQUENTIAL] Setup Store 반영기 구축
- Owner Role: implementer
- Write Scope: `src/features/manage-school-setup/model/store.ts`, `src/features/manage-school-setup/index.ts`, repository 연동 코드
- Depends On: Phase 2, Phase 3
- [ ] **파일 SSOT 치환 반영 구현**
  - 목표: 업로드 payload 기반으로 setup 데이터 치환 저장
  - 검증: DB round-trip 후 반영 데이터 동일
- [ ] **orphan 정리 구현**
  - 목표: `fixedEvents`, `teacherPolicies` 참조 무효 항목 정리
  - 검증: 무효 참조 0건 유지
- [ ] **importReport 상태 모델 반영**
  - 목표: 성공/부분/실패 리포트 표준화
  - 검증: 각 상태별 UI 소비 가능 구조 제공

## Phase 5. [SEQUENTIAL] Setup Import UI 탭 완성
- Owner Role: implementer
- Write Scope: `src/pages/setup/ui/setup-page.tsx`, `src/pages/setup/ui/setup-import-panel.tsx`(신규)
- Depends On: Phase 4
- [ ] **Import 탭 추가**
  - 목표: `.xls`, `.xlsx` 업로드 진입점 통합 제공
  - 검증: 탭 전환/파일 선택/업로드 호출 정상 동작
- [ ] **리포트 UX 구현**
  - 목표: 에러/경고/성공 결과를 사용자에게 명확히 표시
  - 검증: blocking error 메시지와 warning 목록 확인 가능

## Phase 6. [SEQUENTIAL] Setup 자동 저장 파이프라인 적용
- Owner Role: implementer
- Write Scope: `src/features/manage-school-setup/model/store.ts`, `src/pages/setup/ui/setup-page.tsx`, `src/shared/lib/hooks/use-unsaved-warning.ts` 사용부
- Depends On: Phase 4
- [ ] **700ms 디바운스 자동 저장 구현**
  - 목표: 입력 후 자동으로 IndexedDB 영구 저장
  - 검증: 저장 버튼 없이 새로고침/재진입 시 데이터 유지
- [ ] **페이지 종료 flush 구현**
  - 목표: `pagehide`/`visibilitychange`에서 즉시 저장
  - 검증: 탭 닫기 직전 입력도 유실 없음
- [ ] **로컬 드래프트 복원 구현**
  - 목표: `setup-draft-v1` 기반 최신 데이터 복원
  - 검증: debounce 대기 구간 종료 전 종료 시 복원 성공

## Phase 7. [SEQUENTIAL] 시수표 업로드 후 자동 재생성 연결
- Owner Role: implementer
- Write Scope: `src/features/manage-school-setup/model/store.ts`, generate/repository 호출 경계
- Depends On: Phase 4
- [ ] **자동 재생성 실행 구현**
  - 목표: 시수표 반영 직후 대상 주차 snapshot 자동 갱신
  - 검증: 새 버전 저장(`append-only`) 확인
- [ ] **재생성 실패 분리 처리 구현**
  - 목표: setup 반영은 유지하고 실패만 리포트
  - 검증: 실패 시 데이터 롤백 없이 경고/오류 노출

## Phase 8. [PARALLEL:PG-2] 통합 검증 + 릴리스 게이트
- Owner Role: verification-worker
- Write Scope: `src/features/manage-school-setup/model/__tests__/**`, `src/pages/setup/ui/__tests__/**`, 문서 업데이트
- Depends On: Phase 5, Phase 6, Phase 7
- [ ] **핵심 통합 시나리오 테스트 추가**
  - 목표: 업로드/자동저장/재생성 종단 시나리오 회귀 방지
  - 검증: 핵심 10개 시나리오 자동화
- [ ] **품질 게이트 실행**
  - 목표: 릴리스 전 정적/동적 검증 통과
  - 검증: `pnpm run typecheck`, `pnpm run lint src`, 핵심 test 통과

---

## 인수 테스트 체크리스트
- [ ] 교사 시수표 정상 업로드 시 교사/과목/배정/기준시수 반영
- [ ] 교사 시수표 헤더 오류 시 반영 중단 + blocking error 표시
- [ ] 최종 시간표 업로드 시 snapshot 새 버전 생성
- [ ] 최종 시간표 교사 충돌 시 전체 반영 중단
- [ ] 이름 불일치 항목 파일 SSOT 규칙으로 정규화 반영
- [ ] setup 입력 후 700ms 내 자동 저장 수행
- [ ] 입력 직후 창 종료 후 재진입 시 데이터 복원
- [ ] 시수표 업로드 후 자동 재생성 실행
- [ ] 자동 재생성 실패 시 setup 반영 유지 + 리포트 노출
- [ ] `/generate`, `/edit`, `/policy`, `/history` 기존 흐름 회귀 없음

## Session Notes
- 문서 계약 상세화 + manage-school-setup 공용 타입 계약 파일/exports 추가
