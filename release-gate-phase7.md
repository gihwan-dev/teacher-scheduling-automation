# Phase 7 릴리스 게이트 (1차 릴리스 품질 게이트)

## 1. 범위 / 비범위

### 범위 (Phase 7)

- 핵심 5요소 인수 시나리오 10건 자동 검증 (`ACCEPT-01` ~ `ACCEPT-10`)
- 로컬 릴리스 게이트 명령 고정 (`pnpm run release:gate`)
- 운영 인수 체크리스트 및 장애 대응 절차 문서화

### 비범위 (Phase 8 이후)

- 시험 모드 전환 기능 구현
- 시험 감독 배정/통계
- 대강 자동 추천 고도화

참고: 시험기간 일반 수업 차단(`HC-04`)은 Phase 7에서 자동 검증한다.

## 2. 자동 게이트 명령과 통과 기준

### 실행 명령

```bash
pnpm run release:gate
```

내부 실행 순서:

1. `pnpm run typecheck`
2. `pnpm run lint src`
3. `pnpm run test:acceptance`
4. `pnpm run test:unit`

### 통과 기준

- 위 4개 명령이 모두 종료 코드 `0`으로 완료된다.
- `test:acceptance`에서 `ACCEPT-01`~`ACCEPT-10` 전부 통과한다.
- Vitest 종료 지연 경고는 기존 알려진 경고로 간주하며 실패로 판정하지 않는다.

## 3. 수동 운영 스모크 체크리스트

1. `/setup`에서 학사일정 이벤트를 추가/수정/저장할 수 있다.
2. 공휴일/휴업일/시험기간에 편집 시 차단 메시지가 사람이 읽을 수 있게 노출된다.
3. `/replacement`에서 영향 리포트 없는 확정이 차단된다.
4. `/history`에서 버전 복제/복원 후 이력 카드가 생성된다.
5. 특정 주차 수정 후 다른 주차 조회 시 기존 버전이 보존된다.
6. 복원 이벤트에서 전후 상태 추적 정보(before/after payload)가 확인된다.

## 4. 치명 결함(critical) 정의

아래 조건 중 하나라도 발생하면 릴리스 불가(critical):

- `pnpm run release:gate` 실패
- `ACCEPT-01`~`ACCEPT-10` 중 1건 이상 실패
- 수동 스모크 중 데이터 무결성 훼손 발생
  - 비대상 주차 오염
  - 복원 추적 정보 누락
  - 트랜잭션 실패 후 스냅샷 부분 저장

목표 조건: critical 결함 `0`건.

## 5. 장애 대응 / 복구 절차 (Rollback)

1. 문제 발생 시 `/history`에서 영향 주차와 마지막 정상 버전을 확인한다.
2. 해당 주차에서 `복원` 실행으로 새 복원 버전을 생성한다.
3. 복원 후 이력에서 `VERSION_RESTORE` 또는 `TRANSACTION_ROLLBACK` 이벤트를 확인한다.
4. `impactSummary`, `conflictDetected`, `rollbackRef`로 복구 사유와 연계 이력을 검증한다.
5. 복구 완료 후 `pnpm run test:acceptance`를 재실행해 핵심 시나리오 회귀를 확인한다.

## 6. Go / No-Go 기준

### Go

- 자동 게이트 통과
- 수동 스모크 전 항목 통과
- critical 결함 0건

### No-Go

- 자동 게이트 실패 또는 critical 결함 1건 이상

