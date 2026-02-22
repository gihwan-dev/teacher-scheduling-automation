import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'
import { useExamModeStore } from '@/features/manage-exam-mode'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WeekVersionSelector } from '@/components/ui/week-version-selector'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { DAYS_OF_WEEK, DAY_LABELS } from '@/shared/lib/constants'
import {
  buildForwardWeekWindow,
  computeWeekTagFromTimestamp,
  getIsoDateForWeekDay,
} from '@/shared/lib/week-tag'

export function ExamPage() {
  const search = useSearch({ from: '/exam' })
  const navigate = useNavigate({ from: '/exam' })

  const {
    weekTag,
    availableWeekTags,
    schoolConfig,
    teachers,
    subjects,
    examModeState,
    slots,
    assignments,
    conflicts,
    stats,
    gateMessage,
    isLoading,
    isSaving,
    isAutoAssigning,
    loadWeek,
    enableExamMode,
    disableExamMode,
    addExamSlot,
    updateExamSlot,
    removeExamSlot,
    autoAssign,
    setAssignmentTeacher,
    saveAll,
  } = useExamModeStore()

  const [newSlotDay, setNewSlotDay] = useState<DayOfWeek>('MON')
  const [newSlotPeriod, setNewSlotPeriod] = useState(1)
  const [newSlotGrade, setNewSlotGrade] = useState(1)
  const [newSlotClassNumber, setNewSlotClassNumber] = useState(1)
  const [newSlotSubjectId, setNewSlotSubjectId] = useState<string | null>(null)
  const [newSlotSubjectName, setNewSlotSubjectName] = useState('시험')
  const [newSlotDuration, setNewSlotDuration] = useState(50)

  useEffect(() => {
    void loadWeek(search.week)
  }, [loadWeek, search.week])

  useEffect(() => {
    if (!weekTag || search.week === weekTag) {
      return
    }
    navigate({
      search: () => ({ week: weekTag }),
      replace: true,
    })
  }, [navigate, search.week, weekTag])

  const weekOptions = useMemo(() => {
    const currentWeekTag = computeWeekTagFromTimestamp(Date.now())
    const weeks = new Set(buildForwardWeekWindow(currentWeekTag, 3))
    for (const week of availableWeekTags) {
      weeks.add(week)
    }
    if (search.week) {
      weeks.add(search.week)
    }
    return [...weeks]
      .sort((a, b) => a.localeCompare(b))
      .map((week) => ({ value: week, label: week }))
  }, [availableWeekTags, search.week])

  const teacherNameById = new Map(teachers.map((teacher) => [teacher.id, teacher.name]))
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]))

  if (isLoading) {
    return <LoadingState />
  }

  if (!schoolConfig) {
    return (
      <EmptyState
        title="설정 데이터가 없습니다"
        description="시험 모드를 사용하려면 먼저 설정 페이지에서 학교 데이터를 저장해주세요."
        actionLabel="설정 페이지로 이동"
        actionTo="/setup"
      />
    )
  }

  const isExamModeEnabled = examModeState?.isEnabled ?? false

  const handleWeekChange = (nextWeek: WeekTag) => {
    navigate({
      search: () => ({ week: nextWeek }),
      replace: true,
    })
  }

  const handleEnable = async () => {
    const ok = await enableExamMode()
    if (!ok) {
      toast.error('시험 모드를 시작할 수 없습니다.')
      return
    }
    toast.success('시험 모드를 시작했습니다.')
  }

  const handleSave = async () => {
    const ok = await saveAll()
    if (!ok) {
      toast.error('감독 배정 충돌을 먼저 해결해주세요.')
      return
    }
    toast.success('시험 모드 데이터를 저장했습니다.')
  }

  const handleAddSlot = () => {
    const subjectName =
      newSlotSubjectId !== null
        ? (subjectById.get(newSlotSubjectId)?.name ?? newSlotSubjectName)
        : newSlotSubjectName

    addExamSlot({
      day: newSlotDay,
      period: newSlotPeriod,
      grade: newSlotGrade,
      classNumber: newSlotClassNumber,
      subjectId: newSlotSubjectId,
      subjectName,
      durationMinutes: newSlotDuration,
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">시험 모드 / 감독 배정</h1>
          <p className="text-sm text-muted-foreground mt-1">
            EXAM_PERIOD 주차에서만 시험 모드를 시작할 수 있습니다.
          </p>
        </div>
        <WeekVersionSelector
          weekOptions={weekOptions}
          selectedWeek={weekTag}
          onWeekChange={handleWeekChange}
          versionOptions={[]}
          disabled={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            시험 모드 상태
            {isExamModeEnabled ? (
              <Badge variant="default">활성</Badge>
            ) : (
              <Badge variant="secondary">비활성</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gateMessage && (
            <p className="text-sm text-destructive">{gateMessage}</p>
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleEnable}
              disabled={isExamModeEnabled || gateMessage !== null}
            >
              시험 모드 시작
            </Button>
            <Button
              variant="outline"
              onClick={() => void disableExamMode()}
              disabled={!isExamModeEnabled}
            >
              비활성화
            </Button>
            <Button variant="outline" onClick={() => void autoAssign()} disabled={!isExamModeEnabled || isAutoAssigning}>
              감독 자동 배정
            </Button>
            <Button onClick={handleSave} disabled={!isExamModeEnabled || isSaving}>
              저장
            </Button>
          </div>
          {stats && (
            <p className="text-sm text-muted-foreground">
              총 {stats.totalSlots}개 슬롯 · 배정 {stats.assignedSlots}개 · 미배정{' '}
              {stats.unassignedSlots}개
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>시험 슬롯</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
            <Select
              items={DAYS_OF_WEEK.map((day) => ({ value: day, label: DAY_LABELS[day] }))}
              value={newSlotDay}
              onValueChange={(value) => value && setNewSlotDay(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day} value={day}>
                    {DAY_LABELS[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={schoolConfig.periodsPerDay}
              value={newSlotPeriod}
              onChange={(event) => setNewSlotPeriod(Number(event.target.value) || 1)}
            />
            <Input
              type="number"
              min={1}
              max={schoolConfig.gradeCount}
              value={newSlotGrade}
              onChange={(event) => setNewSlotGrade(Number(event.target.value) || 1)}
            />
            <Input
              type="number"
              min={1}
              value={newSlotClassNumber}
              onChange={(event) => setNewSlotClassNumber(Number(event.target.value) || 1)}
            />
            <Select
              items={[
                { value: '', label: '과목 미지정' },
                ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
              ]}
              value={newSlotSubjectId ?? ''}
              onValueChange={(value) => {
                if (value === null || value === '') {
                  setNewSlotSubjectId(null)
                  return
                }
                setNewSlotSubjectId(value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="과목" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">과목 미지정</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newSlotSubjectName}
              onChange={(event) => setNewSlotSubjectName(event.target.value)}
              placeholder="시험명"
            />
            <Input
              type="number"
              min={30}
              max={300}
              value={newSlotDuration}
              onChange={(event) => setNewSlotDuration(Number(event.target.value) || 50)}
              placeholder="시간(분)"
            />
            <Button onClick={handleAddSlot} disabled={!isExamModeEnabled}>
              슬롯 추가
            </Button>
          </div>

          <div className="space-y-2">
            {slots.map((slot) => {
              const assignment = assignments.find((item) => item.slotId === slot.id)
              const assignedTeacherName =
                assignment?.teacherId !== null && assignment?.teacherId !== undefined
                  ? (teacherNameById.get(assignment.teacherId) ?? assignment.teacherId)
                  : '미배정'

              return (
                <div key={slot.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {slot.date || (weekTag ? getIsoDateForWeekDay(weekTag, slot.day) : '-')} ({DAY_LABELS[slot.day]}) {slot.period}교시 · {slot.grade}학년 {slot.classNumber}반 · {slot.subjectName}
                    </div>
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={() => removeExamSlot(slot.id)}
                      disabled={!isExamModeEnabled}
                    >
                      삭제
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={schoolConfig.periodsPerDay}
                      value={slot.period}
                      onChange={(event) =>
                        updateExamSlot(slot.id, {
                          period: Number(event.target.value) || 1,
                        })
                      }
                      disabled={!isExamModeEnabled}
                    />
                    <Input
                      type="number"
                      min={1}
                      max={schoolConfig.gradeCount}
                      value={slot.grade}
                      onChange={(event) =>
                        updateExamSlot(slot.id, {
                          grade: Number(event.target.value) || 1,
                        })
                      }
                      disabled={!isExamModeEnabled}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={slot.classNumber}
                      onChange={(event) =>
                        updateExamSlot(slot.id, {
                          classNumber: Number(event.target.value) || 1,
                        })
                      }
                      disabled={!isExamModeEnabled}
                    />
                    <Select
                      items={[
                        { value: '', label: '미배정' },
                        ...teachers.map((teacher) => ({
                          value: teacher.id,
                          label: teacher.name,
                        })),
                      ]}
                      value={assignment?.teacherId ?? ''}
                      onValueChange={(value) =>
                        setAssignmentTeacher(slot.id, value === null || value === '' ? null : value)
                      }
                      disabled={!isExamModeEnabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={assignedTeacherName} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">미배정</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={30}
                      max={300}
                      value={slot.durationMinutes}
                      onChange={(event) =>
                        updateExamSlot(slot.id, {
                          durationMinutes: Number(event.target.value) || 50,
                        })
                      }
                      disabled={!isExamModeEnabled}
                    />
                  </div>
                </div>
              )
            })}
            {slots.length === 0 && (
              <p className="text-sm text-muted-foreground">등록된 시험 슬롯이 없습니다.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">감독 충돌</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {conflicts.map((conflict, index) => (
              <p key={`${conflict.teacherId}-${index}`} className="text-sm text-destructive">
                {conflict.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
