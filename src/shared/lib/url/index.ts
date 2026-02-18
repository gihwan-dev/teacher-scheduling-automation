export { buildSharePayload, computeFlatIndex } from './encoder'
export { restoreFromPayload } from './decoder'
export type { RestoredState } from './decoder'
export { compressToUrl, decompressFromUrl } from './compress'
export type { SharePayload, CompactCell, CompactSchool } from './types'
export {
  SHARE_SCHEMA_VERSION,
  URL_LENGTH_WARNING,
  URL_LENGTH_MAX,
  DAY_TO_INDEX,
  INDEX_TO_DAY,
  CELL_STATUS_TO_INDEX,
  INDEX_TO_CELL_STATUS,
  TRACK_TO_INDEX,
  INDEX_TO_TRACK,
  SUBJECT_TYPE_TO_INDEX,
  INDEX_TO_SUBJECT_TYPE,
  TIME_PREF_TO_INDEX,
  INDEX_TO_TIME_PREF,
} from './constants'
