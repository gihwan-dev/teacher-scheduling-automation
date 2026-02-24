import { Fragment, useCallback, useState } from 'react'
import {
  removeSubjectAndAssignments,
  syncTeacherPatchFromAssignments,
} from './teacher-table.assignment'
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
import { useSetupStore } from '@/features/manage-school-setup'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type EditableClassAssignment = TeachingAssignment & {
  subjectType: 'CLASS'
  grade: number
  classNumber: number
}

function isEditableClassAssignment(
  assignment: TeachingAssignment,
): assignment is EditableClassAssignment {
  return (
    assignment.subjectType === 'CLASS' &&
    assignment.grade !== null &&
    assignment.classNumber !== null
  )
}

function parseNonNegativeInt(value: string): number {
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

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

  const getEditableAssignments = useCallback((teacher: Teacher) => {
    return getTeacherAssignments(teacher).filter(isEditableClassAssignment)
  }, [])

  const updateClassAssignments = useCallback(
    (teacher: Teacher, classAssignments: Array<EditableClassAssignment>) => {
      const nonClassAssignments = getTeacherAssignments(teacher).filter(
        (assignment) => !isEditableClassAssignment(assignment),
      )
      const nextAssignments = [...nonClassAssignments, ...classAssignments]
      updateTeacher(
        teacher.id,
        syncTeacherPatchFromAssignments(teacher, nextAssignments),
      )
    },
    [updateTeacher],
  )

  const handleAdd = () => {
    if (!newName.trim()) return
    addTeacher({
      name: newName.trim(),
      subjectIds: [],
      baseHoursPerWeek: newBaseHours,
      assignments: [],
      homeroom: null,
      classAssignments: [],
    })
    setNewName('')
    setNewBaseHours(18)
  }

  const toggleSubject = useCallback(
    (teacher: Teacher, subjectId: string) => {
      if (teacher.subjectIds.includes(subjectId)) {
        updateTeacher(
          teacher.id,
          removeSubjectAndAssignments(
            teacher,
            getTeacherAssignments(teacher),
            subjectId,
          ),
        )
        return
      }
      updateTeacher(teacher.id, {
        subjectIds: [...teacher.subjectIds, subjectId],
      })
    },
    [updateTeacher],
  )

  const handleAssignmentFieldChange = useCallback(
    (
      teacher: Teacher,
      assignmentId: string,
      updates: Partial<EditableClassAssignment>,
    ) => {
      const nextAssignments = getEditableAssignments(teacher).map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, ...updates } : assignment,
      )
      updateClassAssignments(teacher, nextAssignments)
    },
    [getEditableAssignments, updateClassAssignments],
  )

  const handleAddAssignment = useCallback(
    (teacher: Teacher) => {
      if (!schoolConfig) return
      const defaultSubjectId = teacher.subjectIds[0] ?? subjects[0]?.id
      if (!defaultSubjectId) {
        return
      }

      const nextAssignments = [
        ...getEditableAssignments(teacher),
        {
          id: generateId(),
          subjectId: defaultSubjectId,
          subjectType: 'CLASS' as const,
          grade: 1,
          classNumber: 1,
          hoursPerWeek: 1,
        },
      ]
      updateClassAssignments(teacher, nextAssignments)
    },
    [getEditableAssignments, schoolConfig, subjects, updateClassAssignments],
  )

  const handleRemoveAssignment = useCallback(
    (teacher: Teacher, assignmentId: string) => {
      const nextAssignments = getEditableAssignments(teacher).filter(
        (assignment) => assignment.id !== assignmentId,
      )
      updateClassAssignments(teacher, nextAssignments)
    },
    [getEditableAssignments, updateClassAssignments],
  )

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]" />
            <TableHead className="w-[140px]">이름</TableHead>
            <TableHead>담당 과목</TableHead>
            <TableHead className="w-[170px]">담임</TableHead>
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
            const assignments = getEditableAssignments(teacher)

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
                    <div className="flex flex-wrap gap-1">
                      {subjects.map((subject) => (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => toggleSubject(teacher, subject.id)}
                          className={`rounded px-2 py-0.5 text-xs transition-colors ${
                            teacher.subjectIds.includes(subject.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {subject.abbreviation}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {!schoolConfig ? (
                      <span className="text-xs text-muted-foreground">-</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Select
                          items={Array.from(
                            { length: schoolConfig.gradeCount },
                            (_, index) => ({
                              value: String(index + 1),
                              label: `${index + 1}학년`,
                            }),
                          )}
                          value={teacher.homeroom ? String(teacher.homeroom.grade) : ''}
                          onValueChange={(value) => {
                            if (!value) {
                              return
                            }
                            const grade = Number(value)
                            updateTeacher(teacher.id, {
                              homeroom: { grade, classNumber: 1 },
                            })
                          }}
                        >
                          <SelectTrigger size="sm" className="w-20">
                            <SelectValue placeholder="학년" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(
                              { length: schoolConfig.gradeCount },
                              (_, index) => index + 1,
                            ).map((grade) => (
                              <SelectItem key={grade} value={String(grade)}>
                                {grade}학년
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          items={
                            teacher.homeroom
                              ? Array.from(
                                  {
                                    length:
                                      schoolConfig.classCountByGrade[
                                        teacher.homeroom.grade
                                      ] ?? 0,
                                  },
                                  (_, index) => ({
                                    value: String(index + 1),
                                    label: `${index + 1}반`,
                                  }),
                                )
                              : []
                          }
                          value={
                            teacher.homeroom
                              ? String(teacher.homeroom.classNumber)
                              : ''
                          }
                          onValueChange={(value) => {
                            if (!teacher.homeroom || !value) {
                              return
                            }
                            updateTeacher(teacher.id, {
                              homeroom: {
                                ...teacher.homeroom,
                                classNumber: Number(value),
                              },
                            })
                          }}
                          disabled={!teacher.homeroom}
                        >
                          <SelectTrigger size="sm" className="w-16">
                            <SelectValue placeholder="반" />
                          </SelectTrigger>
                          <SelectContent>
                            {teacher.homeroom &&
                              Array.from(
                                {
                                  length:
                                    schoolConfig.classCountByGrade[
                                      teacher.homeroom.grade
                                    ] ?? 0,
                                },
                                (_, index) => index + 1,
                              ).map((classNumber) => (
                                <SelectItem
                                  key={classNumber}
                                  value={String(classNumber)}
                                >
                                  {classNumber}반
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            updateTeacher(teacher.id, { homeroom: null })
                          }
                          title="담임 해제"
                        >
                          x
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={teacher.baseHoursPerWeek}
                      onChange={(e) =>
                        updateTeacher(teacher.id, {
                          baseHoursPerWeek: parseNonNegativeInt(e.target.value),
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
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={() => removeTeacher(teacher.id)}
                    >
                      삭제
                    </Button>
                  </TableCell>
                </TableRow>

                {isExpanded && schoolConfig && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">과목별 배정 시수</p>
                          <Button
                            size="xs"
                            onClick={() => handleAddAssignment(teacher)}
                            disabled={subjects.length === 0}
                          >
                            배정 행 추가
                          </Button>
                        </div>

                        {subjects.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            배정 행을 추가하려면 먼저 과목을 등록하세요.
                          </p>
                        )}

                        {assignments.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            배정 행이 없습니다. 과목/학년/반/시수를 추가하세요.
                          </p>
                        )}

                        {assignments.map((assignment) => {
                          const classCount =
                            schoolConfig.classCountByGrade[assignment.grade] ?? 0
                          const classOptions = Array.from(
                            { length: classCount },
                            (_, index) => index + 1,
                          )

                          return (
                            <div
                              key={assignment.id}
                              className="grid grid-cols-5 gap-2 items-center"
                            >
                              <Select
                                items={subjects.map((subject) => ({
                                  value: subject.id,
                                  label: subject.name,
                                }))}
                                value={assignment.subjectId}
                                onValueChange={(value) => {
                                  if (!value) {
                                    return
                                  }
                                  handleAssignmentFieldChange(
                                    teacher,
                                    assignment.id,
                                    { subjectId: value },
                                  )
                                }}
                              >
                                <SelectTrigger size="sm">
                                  <SelectValue placeholder="과목" />
                                </SelectTrigger>
                                <SelectContent>
                                  {subjects.map((subject) => (
                                    <SelectItem key={subject.id} value={subject.id}>
                                      {subject.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                items={Array.from(
                                  { length: schoolConfig.gradeCount },
                                  (_, index) => ({
                                    value: String(index + 1),
                                    label: `${index + 1}학년`,
                                  }),
                                )}
                                value={String(assignment.grade)}
                                onValueChange={(value) => {
                                  if (!value) {
                                    return
                                  }
                                  const grade = Number(value)
                                  const nextClassCount =
                                    schoolConfig.classCountByGrade[grade] ?? 1
                                  handleAssignmentFieldChange(
                                    teacher,
                                    assignment.id,
                                    {
                                      grade,
                                      classNumber: Math.min(
                                        assignment.classNumber,
                                        Math.max(1, nextClassCount),
                                      ),
                                    },
                                  )
                                }}
                              >
                                <SelectTrigger size="sm">
                                  <SelectValue placeholder="학년" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from(
                                    { length: schoolConfig.gradeCount },
                                    (_, index) => index + 1,
                                  ).map((grade) => (
                                    <SelectItem key={grade} value={String(grade)}>
                                      {grade}학년
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                items={classOptions.map((classNumber) => ({
                                  value: String(classNumber),
                                  label: `${classNumber}반`,
                                }))}
                                value={String(assignment.classNumber)}
                                onValueChange={(value) => {
                                  if (!value) {
                                    return
                                  }
                                  handleAssignmentFieldChange(
                                    teacher,
                                    assignment.id,
                                    { classNumber: Number(value) },
                                  )
                                }}
                                disabled={classOptions.length === 0}
                              >
                                <SelectTrigger size="sm">
                                  <SelectValue placeholder="반" />
                                </SelectTrigger>
                                <SelectContent>
                                  {classOptions.map((classNumber) => (
                                    <SelectItem
                                      key={classNumber}
                                      value={String(classNumber)}
                                    >
                                      {classNumber}반
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Input
                                type="number"
                                min={0}
                                value={assignment.hoursPerWeek}
                                onChange={(e) =>
                                  handleAssignmentFieldChange(
                                    teacher,
                                    assignment.id,
                                    {
                                      hoursPerWeek: parseNonNegativeInt(
                                        e.target.value,
                                      ),
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
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell>
              <Input
                type="number"
                min={0}
                value={newBaseHours}
                onChange={(e) =>
                  setNewBaseHours(parseNonNegativeInt(e.target.value))
                }
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
