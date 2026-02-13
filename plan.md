# 학교 시간표 관리 시스템 구현 계획 (FSD 기반)

## 참조 문서
- `SPEC.md`
- `survey.md`

## 1. 목적
- 제약 충족 기반 시간표 생성/수정/교체를 안정적으로 제공하는 구조를 수립한다.
- 필수 제약 100% 준수, 잠금 보존 부분 재계산, 유효 후보 중심 교체 탐색을 제품의 핵심 품질로 고정한다.
- 학기 중 정책 변경과 기능 확장을 기존 코드 대규모 수정 없이 수용할 수 있도록 FSD + SOLID 원칙으로 설계한다.

## 2. 아키텍처 개요

### 2.1 레이어 전략 (FSD)
- `app`: 라우팅, 전역 프로바이더(Query/Store), 권한 게이트, 에러 바운더리
- `pages`: 화면 단위 진입점(기초 생성, 편집/재계산, 교체 탐색, 정책 관리)
- `widgets`: 복합 UI(시간표 그리드, 교체 후보 패널, 변경 이력 타임라인)
- `features`: 사용자 액션 단위 유스케이스(생성, 잠금, 재계산, 교체 확정, 되돌리기/앞으로 가기)
- `entities`: 도메인 모델/검증 규칙/리포지토리 인터페이스(시간표 셀, 제약 정책, 변경 이벤트)
- `shared`: 공통 인프라(API 클라이언트, 유틸, 공통 UI, 타입 기초)

### 2.2 슬라이스 전략
- `timetable`: 시간표 구조/셀 상태/스냅샷
- `teacher-policy`: 교사 선호/회피/일일 시수 정책
- `constraint-policy`: 학생/교사 연강 및 일일 제한 정책
- `locking`: 셀 잠금 상태 관리
- `replacement`: 교체 후보 탐색/정렬/확정
- `change-history`: 상태 전이 및 시각화 이벤트
- `authz`: 권한 분리(조회/수정/확정/정책 변경)

### 2.3 설계 원칙 적용
- SRP: 기능별 유스케이스를 `features` 단위로 분리하고 UI는 표현 책임만 가진다.
- OCP: 제약 검증 규칙과 후보 정렬 규칙을 전략 인터페이스로 열어 신규 정책을 확장으로 추가한다.
- DIP: `features`는 구체 API가 아닌 `entities/*/repository` 인터페이스에 의존한다.
- 높은 응집도: 정책/검증/상태 전이는 각 슬라이스에 코로케이션한다.
- 낮은 결합도: 슬라이스 간 직접 참조를 금지하고 `pages/widgets`에서만 합성한다.

## 3. 요구사항 매핑 (SPEC → 구현 항목)

| 요구사항 | 구현 대상(FSD) | 핵심 유스케이스 | 완료 기준 |
|---|---|---|---|
| F1 기초 시간표 자동 생성 | `features/generate-timetable`, `entities/timetable`, `entities/constraint-policy` | 필수 제약 우선 충족 + 선호 점수 최적화 생성 | 필수 제약 위반 0건, 생성 결과/사유 리포트 제공 |
| F2 교사 배치 조건 관리 | `features/manage-teacher-policy`, `entities/teacher-policy` | 회피/선호/연강 허용치 저장 및 유효성 검증 | 상충 조건 저장 차단 + 수정 가이드 제공 |
| F3 수동 수정 및 잠금 | `features/edit-slot`, `features/toggle-lock`, `entities/locking` | 셀 편집/이동, 즉시 충돌 검사, 잠금 상태 반영 | 충돌 시 거부 사유 노출, 상태 태그 동기화 |
| F4 부분 재계산 | `features/recompute-unlocked`, `entities/timetable` | 잠금 고정 후 비잠금 범위 재배치 | 잠금 셀 불변 보장, 실패 시 최선안/원인 제공 |
| F5 학기 중 교체 후보 탐색 | `features/find-replacement-candidates`, `entities/replacement`, `entities/constraint-policy` | 교체 대상 기준 후보 검증/정렬/확정 | 유효 후보만 노출, 후보 없음 시 완화 시뮬레이션 제공 |
| F6 연강/일일 제한 검증 | `features/validate-constraints`, `entities/constraint-policy` | 생성/수정/교체 전후 정책 검증 | 위반 위치/유형/심각도 표준 출력 |
| F7 변경 이력 시각화 | `features/track-change-history`, `entities/change-history`, `widgets/history-timeline` | 이벤트 기록, 상태 전이, 색상+텍스트+아이콘 표시 | BASE/TEMP/CONFIRMED/LOCKED 상태 일관성 보장 |
| F8 되돌리기/앞으로 가기 | `features/undo-redo`, `entities/change-history` | 커맨드 스택 기반 편집 복원 | 복원 시 검증 재실행 및 UI 동기화 |
| F9 다중 교체 탐색 | `features/find-multi-replacements`, `entities/replacement` | 다중 슬롯 연계 탐색(1:1:N) | 탐색 시간 상한 내 후보 제시(고급 기능 단계) |

## 4. 디렉토리 구조 제안

```text
src/
  app/
    providers/
    router/
    styles/
  pages/
    timetable-generate-page/
    timetable-edit-page/
    replacement-page/
    policy-admin-page/
  widgets/
    timetable-grid/
    candidate-list-panel/
    constraint-violation-panel/
    history-timeline/
  features/
    generate-timetable/
    manage-teacher-policy/
    edit-slot/
    toggle-lock/
    recompute-unlocked/
    find-replacement-candidates/
    validate-constraints/
    track-change-history/
    undo-redo/
    find-multi-replacements/
  entities/
    timetable/
      model/
      api/
      lib/
    teacher-policy/
      model/
      api/
      lib/
    constraint-policy/
      model/
      api/
      lib/
    locking/
      model/
      lib/
    replacement/
      model/
      api/
      lib/
    change-history/
      model/
      lib/
    authz/
      model/
      lib/
  shared/
    api/
    config/
    lib/
    model/
    ui/
```

## 5. 핵심 컴포넌트/모듈 책임
- `entities/timetable/model`: 시간표 셀, 스냅샷, 상태(BASE/TEMP/CONFIRMED/LOCKED) 타입 정의
- `entities/constraint-policy/lib`: 연강/일일 제한 검증기, 위반 리포트 표준화
- `entities/replacement/lib`: 후보 필터 및 정렬(위반 최소 > 기존안 유사도 > 공강 최소화)
- `features/generate-timetable`: 생성 요청 오케스트레이션, 실패 원인/완화 안내 조립
- `features/recompute-unlocked`: 잠금 보존 재배치 실행, 불가 시 최소 해제 후보 계산
- `features/edit-slot`: 단일 셀 편집과 즉시 충돌 검사/롤백
- `features/track-change-history`: 변경 이벤트 영속화와 주차 경계(월요일 00:00) 태깅
- `widgets/timetable-grid`: 그리드 편집 인터랙션, 접근성 라벨, 키보드 이동/확정

## 6. 데이터 흐름

```mermaid
flowchart LR
  A["사용자 액션 (생성/수정/교체)"] --> B["features 유스케이스"]
  B --> C["entities 검증/정책 엔진"]
  C --> D["repository interface"]
  D --> E["API/DB"]
  E --> D
  D --> C
  C --> F["결과 모델 + 위반 리포트"]
  F --> G["widgets/pages 렌더링"]
  B --> H["change-history 이벤트 기록"]
  H --> G
```

- 서버 상태: TanStack Query로 생성/재계산/후보 조회를 관리한다.
- URL 상태: TanStack Router 검색 파라미터로 학년/반/주차/필터/보기 모드를 보존한다.
- 클라이언트 전역 상태: Zustand로 최소 컨텍스트(선택 대상, 편집 세션 상태)만 유지한다.
- 검증 타이밍: `실시간(편집 중)` + `확정 전(저장/승인 직전)` 2단계로 분리한다.

## 7. 단계별 구현 로드맵

### Phase 1. 기반 구축 (아키텍처/인프라)
- FSD 디렉토리/레이어 가드 설정
- Query/Router/Zustand 기본 프로바이더 구성
- 도메인 타입 및 공통 검증 리포트 포맷 정의
- 권한 모델(조회/수정/확정/정책변경) 골격 반영

### Phase 2. 핵심 기능(Must) 구현
- F1/F2/F6: 생성 + 교사 정책 + 제한 검증 파이프라인 완성
- F3/F4: 수동 수정/잠금/부분 재계산 완성
- F5: 교체 후보 탐색/정렬/확정 플로우 완성
- 회귀 위험 영역(검증/상태 전이/정렬) 우선 테스트 작성

### Phase 3. 운영 고도화(Should/Could)
- F7/F8: 변경 이력 시각화 + undo/redo
- F9: 다중 교체 탐색(탐색 비용 제어 포함)
- 운영 리포트/관찰성(실패 사유 통계, 정책 영향도) 추가

## 8. 테스트/품질 계획
- 단위 테스트: 제약 검증기, 후보 정렬기, 상태 전이 로직
- 통합 테스트: 생성→수정→재계산→교체 확정 핵심 시나리오
- 브라우저 모드 테스트: 시간표 그리드 편집/키보드 조작/접근성 표기
- 품질 게이트: ESLint, TypeScript, FSD 의존 규칙 검증, 핵심 경로 회귀 테스트

## 9. 확장 전략
- 정책 확장: 새 제약(예: 블록타임, 실험실 우선 배치)은 `constraint-policy` 전략 추가로 확장
- 정렬 확장: 교체 후보 랭킹 기준 추가 시 `replacement` 정렬 전략 플러그인만 교체
- 채널 확장: 향후 모바일/리포트 채널은 `widgets/pages`만 확장하고 도메인 계층은 재사용
- 데이터 소스 확장: 리포지토리 인터페이스 유지로 외부 학사 시스템 연동 비용 최소화

## 10. 리스크 및 대응
- 과도한 잠금으로 재계산 불가: 최소 해제 셀 제안 알고리즘을 기본 제공한다.
- 상충 정책 입력 증가: 정책 저장 전 시뮬레이션 검증을 강제한다.
- 학기 중 정책 변경 회귀: 변경 전후 비교 스냅샷과 이력 감사 로그를 유지한다.
- 탐색 비용 급증(F9): 시간 상한 + 빔서치/휴리스틱 탐색으로 계산량을 통제한다.
