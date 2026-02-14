import { describe, expect, it } from 'vitest'
import { compressToUrl, decompressFromUrl } from '../compress'

describe('compressToUrl / decompressFromUrl', () => {
  it('round-trip: 압축 후 복원하면 원본과 동일하다', () => {
    const original = JSON.stringify({ hello: 'world', num: 42, arr: [1, 2, 3] })
    const compressed = compressToUrl(original)
    const restored = decompressFromUrl(compressed)
    expect(restored).toBe(original)
  })

  it('빈 객체도 round-trip이 성공한다', () => {
    const original = '{}'
    const compressed = compressToUrl(original)
    expect(decompressFromUrl(compressed)).toBe(original)
  })

  it('큰 데이터도 round-trip이 성공한다', () => {
    const bigArray = Array.from({ length: 500 }, (_, i) => ({ idx: i, val: `item-${i}` }))
    const original = JSON.stringify(bigArray)
    const compressed = compressToUrl(original)
    expect(decompressFromUrl(compressed)).toBe(original)
  })

  it('압축된 결과는 URL-safe 문자만 포함한다', () => {
    const original = JSON.stringify({ key: '한글 데이터 + special chars: &=?' })
    const compressed = compressToUrl(original)
    // lz-string의 compressToEncodedURIComponent 결과는 알파벳, 숫자, +, -, $ 만 포함
    expect(compressed).toMatch(/^[A-Za-z0-9+\-$]*$/)
  })

  it('손상된 데이터 복원 시 에러를 던진다', () => {
    expect(() => decompressFromUrl('')).toThrow('링크 데이터가 손상되었습니다.')
  })
})
