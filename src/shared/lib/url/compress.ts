import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string'

export function compressToUrl(json: string): string {
  const compressed = compressToEncodedURIComponent(json)
  if (!compressed) {
    throw new Error('링크 데이터 압축에 실패했습니다.')
  }
  return compressed
}

export function decompressFromUrl(compressed: string): string {
  const json = decompressFromEncodedURIComponent(compressed)
  if (!json) {
    throw new Error('링크 데이터가 손상되었습니다.')
  }
  return json
}
