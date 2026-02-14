import { useState } from 'react'
import type { SubjectTrack } from '@/entities/subject'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSetupStore } from '@/features/manage-school-setup'

const TRACK_LABELS: Record<SubjectTrack, string> = {
  COMMON: '공통',
  NATURAL_SCIENCE: '자연과학',
  SOCIAL_SCIENCE: '사회과학',
  ARTS: '예술',
  PHYSICAL: '체육',
  OTHER: '기타',
}

const TRACKS: Array<SubjectTrack> = [
  'COMMON',
  'NATURAL_SCIENCE',
  'SOCIAL_SCIENCE',
  'ARTS',
  'PHYSICAL',
  'OTHER',
]

export function SubjectTable() {
  const { subjects, addSubject, updateSubject, removeSubject } = useSetupStore()
  const [newName, setNewName] = useState('')
  const [newAbbr, setNewAbbr] = useState('')
  const [newTrack, setNewTrack] = useState<SubjectTrack>('COMMON')

  const handleAdd = () => {
    if (!newName.trim() || !newAbbr.trim()) return
    addSubject({ name: newName.trim(), abbreviation: newAbbr.trim(), track: newTrack })
    setNewName('')
    setNewAbbr('')
    setNewTrack('COMMON')
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">과목명</TableHead>
            <TableHead className="w-[120px]">약칭</TableHead>
            <TableHead className="w-[160px]">계열</TableHead>
            <TableHead className="w-[80px]">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subjects.map((subject) => (
            <TableRow key={subject.id}>
              <TableCell>
                <Input
                  value={subject.name}
                  onChange={(e) => updateSubject(subject.id, { name: e.target.value })}
                  className="h-7"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={subject.abbreviation}
                  onChange={(e) =>
                    updateSubject(subject.id, { abbreviation: e.target.value })
                  }
                  className="h-7"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={subject.track}
                  onValueChange={(val) => val && updateSubject(subject.id, { track: val })}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TRACK_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => removeSubject(subject.id)}
                >
                  삭제
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {/* 새 과목 추가 행 */}
          <TableRow>
            <TableCell>
              <Input
                placeholder="과목명"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-7"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </TableCell>
            <TableCell>
              <Input
                placeholder="약칭"
                value={newAbbr}
                onChange={(e) => setNewAbbr(e.target.value)}
                className="h-7"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </TableCell>
            <TableCell>
              <Select value={newTrack} onValueChange={(val) => val && setNewTrack(val)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACKS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRACK_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Button size="xs" onClick={handleAdd}>
                추가
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {subjects.length === 0 && (
        <p className="text-muted-foreground text-center text-sm py-4">
          등록된 과목이 없습니다. 위에서 과목을 추가하세요.
        </p>
      )}
    </div>
  )
}
