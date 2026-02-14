import { Fragment, useCallback, useState } from 'react'
import type { ClassHoursAssignment, Teacher } from '@/entities/teacher'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSetupStore } from '@/features/manage-school-setup'
import { validateHoursConsistency } from '@/entities/teacher'

export function TeacherTable() {
  const { teachers, subjects, schoolConfig, addTeacher, updateTeacher, removeTeacher } =
    useSetupStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newBaseHours, setNewBaseHours] = useState(18)

  const handleAdd = () => {
    if (!newName.trim()) return
    addTeacher({
      name: newName.trim(),
      subjectIds: [],
      baseHoursPerWeek: newBaseHours,
      classAssignments: [],
    })
    setNewName('')
    setNewBaseHours(18)
  }

  const toggleSubject = useCallback(
    (teacher: Teacher, subjectId: string) => {
      const newIds = teacher.subjectIds.includes(subjectId)
        ? teacher.subjectIds.filter((id) => id !== subjectId)
        : [...teacher.subjectIds, subjectId]
      updateTeacher(teacher.id, { subjectIds: newIds })
    },
    [updateTeacher],
  )

  const handleAssignmentChange = useCallback(
    (teacher: Teacher, grade: number, classNumber: number, hours: number) => {
      if (isNaN(hours) || hours < 0) return
      const existing = teacher.classAssignments.find(
        (a) => a.grade === grade && a.classNumber === classNumber,
      )
      let newAssignments: Array<ClassHoursAssignment>
      if (existing) {
        if (hours === 0) {
          newAssignments = teacher.classAssignments.filter(
            (a) => !(a.grade === grade && a.classNumber === classNumber),
          )
        } else {
          newAssignments = teacher.classAssignments.map((a) =>
            a.grade === grade && a.classNumber === classNumber
              ? { ...a, hoursPerWeek: hours }
              : a,
          )
        }
      } else if (hours > 0) {
        newAssignments = [...teacher.classAssignments, { grade, classNumber, hoursPerWeek: hours }]
      } else {
        return
      }
      updateTeacher(teacher.id, { classAssignments: newAssignments })
    },
    [updateTeacher],
  )

  const getAssignmentHours = (teacher: Teacher, grade: number, classNumber: number) => {
    return (
      teacher.classAssignments.find(
        (a) => a.grade === grade && a.classNumber === classNumber,
      )?.hoursPerWeek ?? 0
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]" />
            <TableHead className="w-[140px]">이름</TableHead>
            <TableHead>담당 과목</TableHead>
            <TableHead className="w-[100px]">기준 시수</TableHead>
            <TableHead className="w-[100px]">배정 합계</TableHead>
            <TableHead className="w-[80px]">상태</TableHead>
            <TableHead className="w-[80px]">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => {
            const consistency = validateHoursConsistency(teacher)
            const isExpanded = expandedId === teacher.id
            return (
              <Fragment key={teacher.id}>
                <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setExpandedId(isExpanded ? null : teacher.id)}
                    >
                      {isExpanded ? '−' : '+'}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={teacher.name}
                      onChange={(e) => updateTeacher(teacher.id, { name: e.target.value })}
                      className="h-7"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {subjects.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSubject(teacher, s.id)}
                          className={`rounded px-2 py-0.5 text-xs transition-colors ${
                            teacher.subjectIds.includes(s.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {s.abbreviation}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={teacher.baseHoursPerWeek}
                      onChange={(e) =>
                        updateTeacher(teacher.id, {
                          baseHoursPerWeek: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="h-7 w-20"
                    />
                  </TableCell>
                  <TableCell className="text-center">{consistency.assigned}</TableCell>
                  <TableCell>
                    {consistency.valid ? (
                      <Badge variant="secondary">일치</Badge>
                    ) : (
                      <Badge variant="destructive">불일치</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={() => removeTeacher(teacher.id)}
                    >
                      삭제
                    </Button>
                  </TableCell>
                </TableRow>
                {/* 확장 행: 학년/반별 배정 시수 그리드 */}
                {isExpanded && schoolConfig && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium">학년/반별 배정 시수</p>
                        {Array.from({ length: schoolConfig.gradeCount }, (_, i) => i + 1).map(
                          (grade) => (
                            <div key={grade} className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">
                                {grade}학년
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {Array.from(
                                  { length: schoolConfig.classCountByGrade[grade] ?? 0 },
                                  (_, j) => j + 1,
                                ).map((cls) => (
                                  <div key={cls} className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground w-6 text-right">
                                      {cls}반
                                    </span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={getAssignmentHours(teacher, grade, cls)}
                                      onChange={(e) =>
                                        handleAssignmentChange(
                                          teacher,
                                          grade,
                                          cls,
                                          parseInt(e.target.value, 10) || 0,
                                        )
                                      }
                                      className="h-6 w-14 text-xs"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
          {/* 새 교사 추가 행 */}
          <TableRow>
            <TableCell />
            <TableCell>
              <Input
                placeholder="교사 이름"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-7"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </TableCell>
            <TableCell />
            <TableCell>
              <Input
                type="number"
                min={0}
                value={newBaseHours}
                onChange={(e) => setNewBaseHours(parseInt(e.target.value, 10) || 0)}
                className="h-7 w-20"
              />
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell>
              <Button size="xs" onClick={handleAdd}>
                추가
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {teachers.length === 0 && (
        <p className="text-muted-foreground text-center text-sm py-4">
          등록된 교사가 없습니다. 위에서 교사를 추가하세요.
        </p>
      )}
    </div>
  )
}
