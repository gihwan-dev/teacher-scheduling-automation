import type { SchoolConfig } from '@/entities/school'
import type { Subject } from '@/entities/subject'
import type { Teacher } from '@/entities/teacher'
import type { TeacherPolicy, TimePreference } from '@/entities/teacher-policy'
import type { DayOfWeek } from '@/shared/lib/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTeacherPolicyStore } from '@/features/manage-teacher-policy'
import { DAY_LABELS } from '@/shared/lib/constants'

interface TeacherPolicyCardProps {
  teacher: Teacher
  subjects: Array<Subject>
  policy: TeacherPolicy | undefined
  schoolConfig: SchoolConfig
}

const TIME_PREFERENCE_OPTIONS: Array<{
  value: TimePreference
  label: string
}> = [
  { value: 'NONE', label: '선호 없음' },
  { value: 'MORNING', label: '오전' },
  { value: 'AFTERNOON', label: '오후' },
]

export function TeacherPolicyCard({
  teacher,
  subjects,
  policy,
  schoolConfig,
}: TeacherPolicyCardProps) {
  const {
    toggleAvoidanceSlot,
    setTimePreference,
    setMaxConsecutiveOverride,
    setMaxDailyOverride,
    resetPolicy,
  } = useTeacherPolicyStore()

  const { activeDays, periodsPerDay } = schoolConfig

  const isAvoided = (day: DayOfWeek, period: number): boolean => {
    return (
      policy?.avoidanceSlots.some(
        (s) => s.day === day && s.period === period,
      ) ?? false
    )
  }

  const handleToggleSlot = (day: DayOfWeek, period: number) => {
    toggleAvoidanceSlot(teacher.id, { day, period })
  }

  const handleTimePreference = (value: string | null) => {
    if (value !== null) {
      setTimePreference(teacher.id, value as TimePreference)
    }
  }

  const handleConsecutiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setMaxConsecutiveOverride(teacher.id, raw === '' ? null : Number(raw))
  }

  const handleDailyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setMaxDailyOverride(teacher.id, raw === '' ? null : Number(raw))
  }

  const avoidanceCount =
    policy?.avoidanceSlots.filter(
      (s) =>
        activeDays.includes(s.day) &&
        s.period >= 1 &&
        s.period <= periodsPerDay,
    ).length ?? 0
  const totalSlots = activeDays.length * periodsPerDay
  const subjectNameById = new Map(
    subjects.map((subject) => [subject.id, subject.name]),
  )
  const teacherSubjectNames = teacher.subjectIds.map(
    (subjectId) => subjectNameById.get(subjectId) ?? subjectId,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{teacher.name}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetPolicy(teacher.id)}
            disabled={!policy}
          >
            초기화
          </Button>
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          과목:{' '}
          {teacherSubjectNames.length > 0
            ? teacherSubjectNames.join(', ')
            : '미지정'}{' '}
          · 주당{' '}
          {teacher.classAssignments.reduce((s, a) => s + a.hoursPerWeek, 0)}시수
          · 회피 {avoidanceCount}/{totalSlots}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 회피 그리드 */}
        <div>
          <Label className="text-sm font-medium">회피 시간대</Label>
          <p className="text-muted-foreground text-xs mb-2">
            클릭하여 회피 시간을 토글합니다
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="pr-2 text-left text-muted-foreground font-normal">
                    교시
                  </th>
                  {activeDays.map((day) => (
                    <th
                      key={day}
                      className="px-1 text-center text-muted-foreground font-normal min-w-[2.5rem]"
                    >
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(
                  (period) => (
                    <tr key={period}>
                      <td className="pr-2 text-muted-foreground">{period}</td>
                      {activeDays.map((day) => {
                        const avoided = isAvoided(day, period)
                        return (
                          <td key={day} className="px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSlot(day, period)}
                              className={`w-full h-6 rounded text-[10px] transition-colors ${
                                avoided
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                  : 'bg-muted hover:bg-muted/70'
                              }`}
                            >
                              {avoided ? 'X' : ''}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 선호 시간대 */}
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium shrink-0">선호 시간대</Label>
          <Select
            items={TIME_PREFERENCE_OPTIONS}
            value={policy?.timePreference ?? 'NONE'}
            onValueChange={handleTimePreference}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_PREFERENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 연강 허용 한도 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-sm">연강 허용 한도</Label>
            <Input
              type="number"
              min={1}
              max={periodsPerDay}
              placeholder="전역 설정 사용"
              value={policy?.maxConsecutiveHoursOverride ?? ''}
              onChange={handleConsecutiveChange}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">일일 최대 시수</Label>
            <Input
              type="number"
              min={1}
              max={periodsPerDay}
              placeholder="전역 설정 사용"
              value={policy?.maxDailyHoursOverride ?? ''}
              onChange={handleDailyChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
