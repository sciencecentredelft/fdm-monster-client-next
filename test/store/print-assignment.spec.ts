import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePrinterStore } from '@/store/printer.store'
import { usePrinterStateStore } from '@/store/printer-state.store'
import { useUploadsStore } from '@/store/uploads.store'
import { PrinterRemoteFileService } from '@/backend'
import { confirmPrintAssignment } from '@/shared/print-assignment.composable'
import type { PrinterDto } from '@/models/printers/printer.model'

vi.mock('@/shared/print-assignment.composable', () => ({ confirmPrintAssignment: vi.fn() }))
vi.mock('@/backend', () => ({
  PrinterRemoteFileService: { selectAndPrintFile: vi.fn(), uploadFile: vi.fn() },
  PrintersService: {}
}))

const printer: PrinterDto = {
  id: 1, name: 'Alpha', printerType: 0, enabled: true, dateAdded: 0,
  disabledReason: '', webSocketURL: '', apiKey: '', username: '', password: '', printerURL: 'http://127.0.0.1'
}
const other = { ...printer, id: 2, name: 'Bravo' }
const file = new File(['gcode'], 'test.gcode')

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  usePrinterStore().printers = [printer, other]
  vi.mocked(confirmPrintAssignment).mockResolvedValue('Alice')
})

describe('immediate print assignment flows', () => {
  it('confirms an existing file before sending its name to the start API', async () => {
    await usePrinterStateStore().selectAndPrintFile({ printerId: 1, fullPath: 'folder/test.gcode' })
    expect(confirmPrintAssignment).toHaveBeenCalledWith([{
      printerId: 1, printerName: 'Alpha', fileName: 'folder/test.gcode', existingFile: true
    }])
    expect(PrinterRemoteFileService.selectAndPrintFile).toHaveBeenCalledWith(1, 'folder/test.gcode', true, 'Alice')
  })

  it('does not send a print command after cancellation', async () => {
    vi.mocked(confirmPrintAssignment).mockResolvedValue(null)
    await usePrinterStateStore().selectAndPrintFile({ printerId: 1, fullPath: 'test.gcode' })
    expect(PrinterRemoteFileService.selectAndPrintFile).not.toHaveBeenCalled()
  })

  it('keeps the original print request when assignment is disabled', async () => {
    vi.mocked(confirmPrintAssignment).mockResolvedValue(undefined)
    await usePrinterStateStore().selectAndPrintFile({ printerId: 1, fullPath: 'test.gcode' })
    expect(PrinterRemoteFileService.selectAndPrintFile).toHaveBeenCalledWith(1, 'test.gcode', true, undefined)
  })

  it('confirms a whole upload batch once and carries the name into each deferred upload', async () => {
    const store = useUploadsStore()
    await store.queueUploads([
      { printer, file, startPrint: true },
      { printer: other, file, startPrint: true }
    ])
    expect(confirmPrintAssignment).toHaveBeenCalledTimes(1)
    expect(confirmPrintAssignment).toHaveBeenCalledWith([
      { printerId: 1, printerName: 'Alpha', fileName: 'test.gcode' },
      { printerId: 2, printerName: 'Bravo', fileName: 'test.gcode' }
    ])
    await store.handleNextUpload()
    await store.handleNextUpload()
    expect(PrinterRemoteFileService.uploadFile).toHaveBeenNthCalledWith(1, printer, file, true, 'Alice')
    expect(PrinterRemoteFileService.uploadFile).toHaveBeenNthCalledWith(2, other, file, true, 'Alice')
  })

  it('does not enqueue uploads after cancellation', async () => {
    vi.mocked(confirmPrintAssignment).mockResolvedValue(null)
    const store = useUploadsStore()
    expect(await store.queueUploads([{ printer, file, startPrint: true }])).toBe(false)
    expect(store.queuedUploads).toEqual([])
    expect(PrinterRemoteFileService.uploadFile).not.toHaveBeenCalled()
  })

  it('does not prompt for upload-only or attach a name to it', async () => {
    const store = useUploadsStore()
    await store.queueUploads([{ printer, file, startPrint: false }])
    expect(confirmPrintAssignment).not.toHaveBeenCalled()
    await store.handleNextUpload()
    expect(PrinterRemoteFileService.uploadFile).toHaveBeenCalledWith(printer, file, false, undefined)
  })
})
