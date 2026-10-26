import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import BatchReprintDialog from '@/components/Generic/Dialogs/BatchReprintDialog.vue'
import { BatchService } from '@/backend/batch.service'
import { confirmPrintAssignment } from '@/shared/print-assignment.composable'
import { DialogName } from '@/components/Generic/Dialogs/dialog.constants'
import { useDialog } from '@/shared/dialog.composable'
import { usePrinterStore } from '@/store/printer.store'
import { ReprintState } from '@/models/batch/reprint.dto'

vi.mock('@/backend/batch.service', () => ({
  BatchService: { batchGetLastPrintedFiles: vi.fn(), batchReprintFiles: vi.fn() }
}))
vi.mock('@/shared/print-assignment.composable', () => ({ confirmPrintAssignment: vi.fn() }))

let wrapper: ReturnType<typeof mount>

beforeEach(async () => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  vi.mocked(BatchService.batchGetLastPrintedFiles).mockResolvedValue([1, 2].map(printerId => ({
    printerId, connectionState: 'Operational', reprintState: ReprintState.LastPrintReady,
    file: { path: `${printerId}.gcode`, dir: false, date: null, size: 1024 }
  })))
  vi.mocked(BatchService.batchReprintFiles).mockResolvedValue([{ printerId: 1, success: true }, { printerId: 2, success: true }])
  vi.mocked(confirmPrintAssignment).mockResolvedValue('Alice')
  wrapper = mount(BatchReprintDialog, {
    global: {
      plugins: [createVuetify()],
      stubs: { VDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' } }
    }
  })
  await useDialog<DialogName.BatchReprintDialog, number[]>(DialogName.BatchReprintDialog).openDialog([1, 2])
  await flushPromises()
})

afterEach(() => { wrapper.unmount() })

async function submit() {
  await wrapper.findAll('button').find(button => button.text().includes('Submit Batch Reprint'))!.trigger('click')
  await flushPromises()
}

describe('batch reprint assignment', () => {
  it('confirms once with the selected files and sends one name for all prints', async () => {
    await submit()
    expect(confirmPrintAssignment).toHaveBeenCalledWith([
      { printerId: 1, printerName: 'Printer #1', fileName: '1.gcode', existingFile: true },
      { printerId: 2, printerName: 'Printer #2', fileName: '2.gcode', existingFile: true }
    ])
    expect(BatchService.batchReprintFiles).toHaveBeenCalledWith([
      { printerId: 1, path: '1.gcode' }, { printerId: 2, path: '2.gcode' }
    ], 'Alice')
  })

  it('does not send a batch command when the assignment popup is cancelled', async () => {
    vi.mocked(confirmPrintAssignment).mockResolvedValue(null)
    await submit()
    expect(BatchService.batchReprintFiles).not.toHaveBeenCalled()
    expect(useDialog(DialogName.BatchReprintDialog).isDialogOpened()).toBe(true)
  })

  it('reports partial failures and keeps the dialog and printer selection', async () => {
    vi.mocked(BatchService.batchReprintFiles).mockResolvedValue([
      { printerId: 1, success: true }, { printerId: 2, failure: true, error: 'Printer busy' }
    ])
    const clearSelection = vi.spyOn(usePrinterStore(), 'clearSelectedPrinters')
    await submit()
    expect(wrapper.text()).toContain('Printer #2: Printer busy')
    expect(useDialog(DialogName.BatchReprintDialog).isDialogOpened()).toBe(true)
    expect(clearSelection).not.toHaveBeenCalled()
  })
})
