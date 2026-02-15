import { z } from 'zod'
import { SHARE_SCHEMA_VERSION } from '@/shared/lib/url/constants'

const compactSchoolSchema = z.object({
  g: z.number().int().min(1).max(3),
  c: z.record(z.coerce.number(), z.number().int().min(1).max(20)),
  d: z.array(z.number().int().min(0).max(5)).min(1),
  p: z.number().int().min(1).max(10),
})

const compactSubjectSchema = z.object({
  n: z.string().min(1),
  a: z.string().min(1),
  t: z.number().int().min(0).max(5),
})

const compactTeacherSchema = z.object({
  n: z.string().min(1),
  s: z.array(z.number().int().min(0)),
  h: z.number().int().min(0),
  ca: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int()])),
})

const compactCellSchema = z.object({
  i: z.number().int().min(0),
  t: z.number().int().min(0),
  s: z.number().int().min(0),
  f: z.number().int().min(0).max(7),
})

const compactPolicySchema = z.object({
  sc: z.number().int().min(1).max(10),
  tc: z.number().int().min(1).max(10),
  td: z.number().int().min(1).max(10),
})

const compactTeacherPolicySchema = z.object({
  ti: z.number().int().min(0),
  av: z.array(
    z.tuple([z.number().int().min(0).max(5), z.number().int().min(1).max(10)]),
  ),
  tp: z.number().int().min(0).max(2),
  mco: z.number().int().min(1).max(10).nullable(),
  mdo: z.number().int().min(1).max(10).nullable(),
})

export const sharePayloadSchema = z
  .object({
    v: z.literal(SHARE_SCHEMA_VERSION),
    meta: z.object({
      score: z.number().min(0),
      genMs: z.number().int().min(0),
      ts: z.string().min(1),
    }),
    school: compactSchoolSchema,
    subjects: z.array(compactSubjectSchema),
    teachers: z.array(compactTeacherSchema),
    grid: z.array(compactCellSchema),
    policy: compactPolicySchema,
    teacherPolicies: z.array(compactTeacherPolicySchema),
  })
  .superRefine((data, ctx) => {
    const subjectCount = data.subjects.length
    const teacherCount = data.teachers.length

    // teacher의 subject 인덱스 범위 검증
    for (let ti = 0; ti < teacherCount; ti++) {
      for (const si of data.teachers[ti].s) {
        if (si >= subjectCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `교사[${ti}]의 과목 인덱스 ${si}가 범위를 초과합니다 (과목 수: ${subjectCount}).`,
            path: ['teachers', ti, 's'],
          })
        }
      }
    }

    // grid 셀의 teacher/subject 인덱스 범위 검증
    for (let ci = 0; ci < data.grid.length; ci++) {
      const cell = data.grid[ci]
      if (cell.t >= teacherCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `셀[${ci}]의 교사 인덱스 ${cell.t}가 범위를 초과합니다 (교사 수: ${teacherCount}).`,
          path: ['grid', ci, 't'],
        })
      }
      if (cell.s >= subjectCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `셀[${ci}]의 과목 인덱스 ${cell.s}가 범위를 초과합니다 (과목 수: ${subjectCount}).`,
          path: ['grid', ci, 's'],
        })
      }
    }

    // teacherPolicy의 teacher 인덱스 범위 검증
    for (let pi = 0; pi < data.teacherPolicies.length; pi++) {
      const tp = data.teacherPolicies[pi]
      if (tp.ti >= teacherCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `교사정책[${pi}]의 교사 인덱스 ${tp.ti}가 범위를 초과합니다 (교사 수: ${teacherCount}).`,
          path: ['teacherPolicies', pi, 'ti'],
        })
      }
    }
  })
