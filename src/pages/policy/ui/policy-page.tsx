import { useEffect } from 'react'

import { TeacherPolicyCard } from './teacher-policy-card'
import { PolicyValidationSummary } from './policy-validation-summary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTeacherPolicyStore } from '@/features/manage-teacher-policy'

export function PolicyPage() {
  const {
    policies,
    teachers,
    schoolConfig,
    selectedTeacherId,
    isDirty,
    isLoading,
    isSaveBlocked,
    validationMessages,
    selectTeacher,
    loadFromDB,
    saveToDB,
    runValidation,
  } = useTeacherPolicyStore()

  useEffect(() => {
    loadFromDB()
  }, [loadFromDB])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">데이터 불러오는 중...</p>
      </div>
    )
  }

  if (!schoolConfig || teachers.length === 0) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">
              설정 페이지에서 학교 구조와 교사를 먼저 입력해주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId)
  const selectedPolicy = policies.find((p) => p.teacherId === selectedTeacherId)

  const errorCount = validationMessages.filter((m) => m.severity === 'error').length
  const warningCount = validationMessages.filter((m) => m.severity === 'warning').length

  const handleSave = async () => {
    const success = await saveToDB()
    if (!success) {
      // 검증 실패 시 메시지가 자동으로 표시됨
    }
  }

  const getTeacherBadge = (teacherId: string) => {
    const hasPolicy = policies.some((p) => p.teacherId === teacherId)
    const hasError = validationMessages.some(
      (m) => m.teacherId === teacherId && m.severity === 'error',
    )
    const hasWarning = validationMessages.some(
      (m) => m.teacherId === teacherId && m.severity === 'warning',
    )

    if (hasError) return <Badge variant="destructive" className="ml-auto text-[10px] px-1.5">오류</Badge>
    if (hasWarning) return <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">경고</Badge>
    if (hasPolicy) return <Badge variant="outline" className="ml-auto text-[10px] px-1.5">설정됨</Badge>
    return null
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">교사 조건 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            교사별 회피 시간대, 선호 시간, 연강 한도 등 개별 조건을 설정합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && <Badge variant="outline">변경사항 있음</Badge>}
          {errorCount > 0 && <Badge variant="destructive">오류 {errorCount}</Badge>}
          {warningCount > 0 && <Badge variant="secondary">경고 {warningCount}</Badge>}
          <Button variant="outline" onClick={runValidation}>
            검증
          </Button>
          <Button onClick={handleSave} disabled={isSaveBlocked && validationMessages.length > 0}>
            저장
          </Button>
        </div>
      </div>

      {/* 메인 레이아웃: 좌 사이드바 + 우 편집 영역 */}
      <div className="flex gap-6">
        {/* 좌: 교사 목록 사이드바 */}
        <div className="w-48 shrink-0 space-y-1">
          <p className="text-xs text-muted-foreground mb-2 font-medium">교사 목록</p>
          {teachers.map((teacher) => (
            <button
              key={teacher.id}
              type="button"
              onClick={() => selectTeacher(teacher.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                selectedTeacherId === teacher.id
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <span className="truncate">{teacher.name}</span>
              {getTeacherBadge(teacher.id)}
            </button>
          ))}
        </div>

        {/* 우: 정책 편집 영역 */}
        <div className="flex-1 min-w-0">
          {selectedTeacher ? (
            <TeacherPolicyCard
              teacher={selectedTeacher}
              policy={selectedPolicy}
              schoolConfig={schoolConfig}
            />
          ) : (
            <Card>
              <CardContent className="flex h-32 items-center justify-center">
                <p className="text-muted-foreground">교사를 선택하세요.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 검증 결과 */}
      <PolicyValidationSummary />
    </div>
  )
}
