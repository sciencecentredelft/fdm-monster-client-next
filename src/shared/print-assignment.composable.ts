import { useSettingsStore } from '@/store/settings.store'
import { useDialog } from '@/shared/dialog.composable'
import { DialogName } from '@/components/Generic/Dialogs/dialog.constants'
import type { PrintAssignmentContext } from '@/components/Generic/Dialogs/dialog.types'

export async function confirmPrintAssignment(prints: PrintAssignmentContext['prints']) {
  const settings = useSettingsStore().serverSettings
  if (!settings?.printAssignmentEnabled && !settings?.checkPrinterStatusBeforePrint) return undefined
  const dialog = useDialog<DialogName.PrintAssignmentDialog, PrintAssignmentContext, string | null>(
    DialogName.PrintAssignmentDialog
  )
  if (dialog.isDialogOpened()) throw new Error('Finish the open print confirmation before starting another print.')
  const result = await dialog.handleAsync({ prints })
  return result === '' ? undefined : result ?? null
}
