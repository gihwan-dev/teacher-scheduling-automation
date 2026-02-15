export { useEditStore } from './model/store'
export { makeCellKey, parseCellKey, buildCellMap } from './lib/cell-key'
export {
  isCellEditable,
  validateCellEdit,
  validateCellMove,
} from './lib/edit-validator'
// confirmChanges는 useEditStore를 통해 접근
