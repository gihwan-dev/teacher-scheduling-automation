import { Fragment, useCallback, useMemo, useState } from 'react'
import type { SubjectType } from '@/shared/lib/types'
import type { Teacher, TeachingAssignment } from '@/entities/teacher'
import {
  getTeacherAssignments,
  validateHoursConsistency,
} from '@/entities/teacher'
import { generateId } from '@/shared/lib/id'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSetupStore } from '@/features/manage-school-setup'

const SUBJECT_TYPE_OPTIONS: Array<{ value: SubjectType; label: string }> = [
  { value: 'CLASS', label: '반 단위' },
  { value: 'GRADE', label: '학년 단위' },
  { value: 'SCHOOL', label: '전교 단위' },
]

export function TeacherTable() {
  const {
    teachers,
    subjects,
    schoolConfig,
    addTeacher,
    updateTeacher,
    removeTeacher,
  } = useSetupStore()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newBaseHours, setNewBaseHours] = useState(18)

  const gradeOptions = useMemo(() => {
    const gradeCount = schoolConfig?.gradeCount ?? 0
    return Array.from({ length: gradeCount }, (_, i) => {
      const grade = i + 1
      return { value: grade, label: `${grade}학년` }
    })
  }, [schoolConfig])

  const handleAddTeacher = () => {
    if (!newName.trim()) return
    addTeacher({
      name: newName.trim(),
      baseHoursPerWeek: newBaseHours,
      assignments: [],
    })
    setNewName('')
    setNewBaseHours(18)
  }

  const getAssignments = useCallback((teacher: Teacher) => {
    return getTeacherAssignments(teacher)
  }, [])

  const updateAssignments = useCallback(
    (teacher: Teacher, assignments: Array<TeachingAssignment>) => {
      updateTeacher(teacher.id, {
        assignments,
        classAssignments: undefined,
        subjectIds: undefined,
      })
    },
    [updateTeacher],
  )

  const handleAssignmentFieldChange = useCallback(
    (
      teacher: Teacher,
      assignmentId: string,
      updates: Partial<TeachingAssignment>,
    ) => {
      const next = getAssignments(teacher).map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, ...updates } : assignment,
      )
      updateAssignments(teacher, next)
    },
    [getAssignments, updateAssignments],
  )

  const handleSubjectTypeChange = useCallback(
    (teacher: Teacher, assignmentId: string, subjectType: SubjectType) => {
      if (subjectType === 'CLASS') {
        handleAssignmentFieldChange(teacher, assignmentId, {
          subjectType,
          grade: 1,
          classNumber: 1,
        })
        return
      }

      if (subjectType === 'GRADE') {
        handleAssignmentFieldChange(teacher, assignmentId, {
          subjectType,
          grade: 1,
          classNumber: null,
        })
        return
      }

      handleAssignmentFieldChange(teacher, assignmentId, {
        subjectType,
        grade: null,
        classNumber: null,
      })
    },
    [handleAssignmentFieldChange],
  )

  const handleAddAssignment = useCallback(
    (teacher: Teacher) => {
      if (!schoolConfig) return
      const firstSubjectId = subjects[0]?.id ?? ''
      const next = [
        ...getAssignments(teacher),
        {
          id: generateId(),
          subjectId: firstSubjectId,
          subjectType: 'CLASS' as const,
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 1,
        },
      ]
      updateAssignments(teacher, next)
    },
    [getAssignments, schoolConfig, subjects, updateAssignments],
  )

  const handleRemoveAssignment = useCallback(
    (teacher: Teacher, assignmentId: string) => {
      const next = getAssignments(teacher).filter((a) => a.id !== assignmentId)
      updateAssignments(teacher, next)
    },
    [getAssignments, updateAssignments],
  )

  const getClassOptions = (grade: number) => {
    const classCount = schoolConfig?.classCountByGrade[grade] ?? 0
    return Array.from({ length: classCount }, (_, i) => {
      const cls = i + 1
      return { value: cls, label: `${cls}반` }
    })
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]" />
            <TableHead className="w-[140px]">이름</TableHead>
            <TableHead className="w-[100px]">기준 시수</TableHead>
            <TableHead className="w-[100px]">배정 합계</TableHead>
            <TableHead className="w-[80px]">상태</TableHead>
            <TableHead className="w-[100px]">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => {
            const consistency = validateHoursConsistency(teacher)
            const isExpanded = expandedId === teacher.id
            const assignments = getAssignments(teacher)

            return (
              <Fragment key={teacher.id}>
                <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : teacher.id)
                      }
                    >
                      {isExpanded ? '−' : '+'}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={teacher.name}
                      onChange={(e) =>
                        updateTeacher(teacher.id, { name: e.target.value })
                      }
                      className="h-7"
                    />
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
                  <TableCell className="text-center">
                    {consistency.assigned}
                  </TableCell>
                  <TableCell>
                    {consistency.valid ? (
                      <Badge variant="secondary">일치</Badge>
                    ) : (
                      <Badge variant="destructive">불일치</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{assignments.length}행</Badge>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => removeTeacher(teacher.id)}
                      >
                        삭제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">수업 배정</p>
                          <Button
                            size="xs"
                            onClick={() => handleAddAssignment(teacher)}
                          >
                            배정 행 추가
                          </Button>
                        </div>

                        {assignments.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            배정 행이 없습니다. 과목/수업유형/대상/시수를 추가하세요.
                          </p>
                        )}

                        {assignments.map((assignment) => {
                          const classOptions =
                            assignment.grade !== null
                              ? getClassOptions(assignment.grade)
                              : []

                          return (
                            <div
                              key={assignment.id}
                              className="grid grid-cols-6 gap-2 items-center"
                            >
                              <Select
                                items={subjects.map((subject) => ({
                                  value: subject.id,
                                  label: subject.name,
                                }))}
                                value={assignment.subjectId}
                                onValueChange={(value) =>
                                  value &&
                                  handleAssignmentFieldChange(
                                    teacher,
                                    assignment.id,
                                    { subjectId: value },
                                  )
                                }
                              >
                                <SelectTrigger size="sm">
                                  <SelectValue placeholder="과목" />
                                </SelectTrigger>
                                <SelectContent>
                                  {subjects.map((subject) => (
                                    <SelectItem
                                      key={subject.id}
                                      value={subject.id}
                                    >
                                      {subject.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                items={SUBJECT_TYPE_OPTIONS}
                                value={assignment.subjectType}
                                onValueChange={(value) =>
                                  value &&
                                  handleSubjectTypeChange(
                                    teacher,
                                    assignment.id,
                                    value,
                                  )
                                }
                              >
                                <SelectTrigger size="sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUBJECT_TYPE_OPTIONS.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {assignment.subjectType !== 'SCHOOL' ? (
                                <Select
                                  items={gradeOptions}
                                  value={assignment.grade ?? 1}
                                  onValueChange={(value) =>
                                    value !== null &&
                                    handleAssignmentFieldChange(
                                      teacher,
                                      assignment.id,
                                      { grade: value },
                                    )
                                  }
                                >
                                  <SelectTrigger size="sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {gradeOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="text-xs text-muted-foreground px-2">
                                  전체
                                </div>
                              )}

                              {assignment.subjectType === 'CLASS' &&
                              assignment.grade !== null ? (
                                <Select
                                  items={classOptions}
                                  value={assignment.classNumber ?? 1}
                                  onValueChange={(value) =>
                                    value !== null &&
                                    handleAssignmentFieldChange(
                                      teacher,
                                      assignment.id,
                                      { classNumber: value },
                                    )
                                  }
                                >
                                  <SelectTrigger size="sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {classOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="text-xs text-muted-foreground px-2">
                                  {assignment.subjectType === 'GRADE'
                                    ? '학년 전체'
                                    : '-'}
                                </div>
                              )}

                              <Input
                                type="number"
                                min={0}
                                value={assignment.hoursPerWeek}
                                onChange={(e) =>
                                  handleAssignmentFieldChange(
                                    teacher,
                                    assignment.id,
                                    {
                                      hoursPerWeek:
                                        parseInt(e.target.value, 10) || 0,
                                    },
                                  )
                                }
                                className="h-8"
                              />

                              <Button
                                variant="destructive"
                                size="xs"
                                onClick={() =>
                                  handleRemoveAssignment(teacher, assignment.id)
                                }
                              >
                                삭제
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}

          <TableRow>
            <TableCell />
            <TableCell>
              <Input
                placeholder="교사 이름"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-7"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTeacher()}
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                min={0}
                value={newBaseHours}
                onChange={(e) =>
                  setNewBaseHours(parseInt(e.target.value, 10) || 0)
                }
                className="h-7 w-20"
              />
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell>
              <Button size="xs" onClick={handleAddTeacher}>
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
