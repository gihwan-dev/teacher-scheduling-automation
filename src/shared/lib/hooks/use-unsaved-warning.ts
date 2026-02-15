import { useBlocker } from '@tanstack/react-router'

export function useUnsavedWarning(isDirty: boolean) {
  useBlocker({
    shouldBlockFn: () => isDirty,
    enableBeforeUnload: true,
  })
}
