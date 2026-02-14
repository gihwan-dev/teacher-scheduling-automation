import { useEffect } from 'react'

import { ConstraintConfigForm } from './constraint-config-form'
import { GenerationResultPanel } from './generation-result-panel'
import { TimetableView } from './timetable-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGenerateStore } from '@/features/generate-timetable/model/store'


export function GeneratePage() {
  const {
    schoolConfig,
    teachers,
    subjects,
    fixedEvents,
    result,
    isGenerating,
    isLoading,
    setupLoaded,
    loadSetupData,
    generate,
  } = useGenerateStore()

  useEffect(() => {
    loadSetupData()
  }, [loadSetupData])

  if (isLoading || !setupLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">데이터 불러오는 중...</p>
      </div>
    )
  }

  if (!schoolConfig) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">
              설정 페이지에서 학교 구조를 먼저 입력해주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalClasses = Object.values(schoolConfig.classCountByGrade).reduce((s, c) => s + c, 0)
  const multiSubjectTeachers = teachers.filter((t) => t.subjectIds.length > 1)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">시간표 생성</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            설정 데이터를 기반으로 시간표를 자동 생성합니다.
          </p>
        </div>
        <Button onClick={generate} disabled={isGenerating}>
          {isGenerating ? '생성 중...' : '생성'}
        </Button>
      </div>

      {/* 설정 요약 */}
      <Card>
        <CardHeader>
          <CardTitle>설정 데이터 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="text-center">
              <p className="text-muted-foreground text-xs">학년</p>
              <p className="text-lg font-semibold">{schoolConfig.gradeCount}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">총 반 수</p>
              <p className="text-lg font-semibold">{totalClasses}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">교사</p>
              <p className="text-lg font-semibold">{teachers.length}명</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">과목</p>
              <p className="text-lg font-semibold">{subjects.length}개</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">고정 이벤트</p>
              <p className="text-lg font-semibold">{fixedEvents.length}건</p>
            </div>
          </div>
          {multiSubjectTeachers.length > 0 && (
            <div className="mt-3">
              <Badge variant="secondary">
                다과목 교사 {multiSubjectTeachers.length}명 (첫 번째 과목으로 배정)
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 제약 설정 */}
      <ConstraintConfigForm />

      {/* 생성 결과 */}
      {result && <GenerationResultPanel result={result} />}

      {/* 시간표 뷰 */}
      {result?.snapshot && (
        <TimetableView
          cells={result.snapshot.cells}
          schoolConfig={schoolConfig}
          teachers={teachers}
          subjects={subjects}
        />
      )}
    </div>
  )
}
