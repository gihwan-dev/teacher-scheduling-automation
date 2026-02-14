import type { RestoredState } from '@/shared/lib/url'
import { decompressFromUrl, restoreFromPayload } from '@/shared/lib/url'
import { sharePayloadSchema } from '@/entities/share-state'
import {
  saveAllSetupData,
  saveConstraintPolicy,
  saveTeacherPolicies,
  saveTimetableSnapshot,
} from '@/shared/persistence/indexeddb/repository'

export function parseShareHash(hash: string): RestoredState {
  const dataPrefix = 'data='
  const dataIndex = hash.indexOf(dataPrefix)
  if (dataIndex === -1) {
    throw new Error('링크 데이터를 찾을 수 없습니다.')
  }

  const compressed = hash.slice(dataIndex + dataPrefix.length)
  if (!compressed) {
    throw new Error('링크 데이터가 비어있습니다.')
  }

  // 1. 압축 해제
  let json: string
  try {
    json = decompressFromUrl(compressed)
  } catch {
    throw new Error('링크 데이터가 손상되었습니다.')
  }

  // 2. JSON 파싱
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('링크 데이터를 해석할 수 없습니다.')
  }

  // 3. 버전 체크 (Zod 이전에 빠른 실패)
  if (typeof raw === 'object' && raw !== null && 'v' in raw && (raw as { v: unknown }).v !== 1) {
    throw new Error('지원하지 않는 공유 형식 버전입니다.')
  }

  // 4. Zod 검증
  const result = sharePayloadSchema.safeParse(raw)
  if (!result.success) {
    throw new Error('링크 데이터 형식이 올바르지 않습니다.')
  }

  // 5. 도메인 객체 복원
  return restoreFromPayload(result.data)
}

export async function importRestoredData(data: RestoredState): Promise<void> {
  await Promise.all([
    saveAllSetupData({
      schoolConfig: data.schoolConfig,
      subjects: data.subjects,
      teachers: data.teachers,
      fixedEvents: [],
    }),
    saveTimetableSnapshot(data.snapshot),
    saveConstraintPolicy(data.constraintPolicy),
    saveTeacherPolicies(data.teacherPolicies),
  ])
}
