import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import PrintAssignmentDialog from '@/components/Generic/Dialogs/PrintAssignmentDialog.vue'
import { PrinterRemoteFileService } from '@/backend/printer-remote-file.service'
import { useDialog } from '@/shared/dialog.composable'
import { DialogName } from '@/components/Generic/Dialogs/dialog.constants'
import type { PrintAssignmentContext } from '@/components/Generic/Dialogs/dialog.types'
import { useSettingsStore } from '@/store/settings.store'
import { confirmPrintAssignment } from '@/shared/print-assignment.composable'
import { usePrinterStore } from '@/store/printer.store'
import { usePrinterStateStore } from '@/store/printer-state.store'
import { PrintersService } from '@/backend/printers.service'
import type { PrinterDto } from '@/models/printers/printer.model'
import { MoonrakerType } from '@/shared/printer-types.constants'

vi.mock('@/backend/printer-remote-file.service', () => ({
  PrinterRemoteFileService: { getLastPrintStarts: vi.fn() }
}))
vi.mock('@/backend/printers.service', () => ({
  PrintersService: { sendPrinterConnectCommand: vi.fn(), refreshSocket: vi.fn() }
}))

const first = { printerId: 1, printerName: 'Alpha', fileName: 'folder/test.gcode', existingFile: true }
const second = { printerId: 2, printerName: 'Bravo', fileName: 'test.gcode', existingFile: true }
let wrapper: ReturnType<typeof mount>
const body = () => new DOMWrapper(document.body)
const input = () => body().get<HTMLInputElement>('input[aria-label="Assigned to"]')
const button = (label: string) => body().findAll('button').find(button => button.text() === label)!
const dialog = () => useDialog<DialogName.PrintAssignmentDialog, PrintAssignmentContext, string | null>(DialogName.PrintAssignmentDialog)

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  useSettingsStore().$patch({ settings: { server: {
    printAssignmentEnabled: true, checkPrinterStatusBeforePrint: true
  } } })
  usePrinterStore().printers = [first, second].map(target => ({
    id: target.printerId, name: target.printerName, enabled: true, printerType: 0,
    dateAdded: 0, disabledReason: '', webSocketURL: '', apiKey: '',
    username: '', password: '', printerURL: 'http://127.0.0.1'
  } satisfies PrinterDto))
  for (const target of [first, second]) {
    usePrinterStateStore().$patch({
      socketStatesById: { [target.printerId]: { api: 'responding', socket: 'authenticated' } },
      printerEventsById: { [target.printerId]: { current: { payload: {
        state: { text: 'Operational', flags: { operational: true, printing: false } }
      } } } }
    })
  }
  vi.mocked(PrintersService.sendPrinterConnectCommand).mockResolvedValue({})
  vi.mocked(PrintersService.refreshSocket).mockResolvedValue({})
  vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockResolvedValue([])
  wrapper = mount(PrintAssignmentDialog, {
    attachTo: document.body,
    global: {
      plugins: [createVuetify()],
      stubs: { VDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' } }
    }
  })
})

afterEach(() => {
  wrapper.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function open(prints = [first]) {
  await dialog().openDialog({ prints })
  await flushPromises()
}

describe('PrintAssignmentDialog', () => {
  it('blocks both button and form submission for an offline printer until live status is ready', async () => {
    usePrinterStateStore().$patch({
      printerEventsById: { 1: { current: { payload: {
        state: { text: 'Offline', flags: { operational: false, closedOrError: true } }
      } } } }
    })
    await open()
    await input().setValue('Alice')
    expect(body().text()).toContain('Alpha: Disconnected')
    expect(button('Start print').attributes('disabled')).toBeDefined()
    await body().get('form').trigger('submit')
    expect(dialog().isDialogOpened()).toBe(true)
    expect(button('Reconnect')).toBeUndefined()
    expect(PrintersService.sendPrinterConnectCommand).toHaveBeenCalledWith(1)
    expect(PrintersService.refreshSocket).not.toHaveBeenCalled()
    expect(body().text()).toContain('Waiting for live printer status')
    expect(button('Start print').attributes('disabled')).toBeDefined()
    usePrinterStateStore().$patch({
      printerEventsById: { 1: { current: { payload: { state: {
        text: 'Operational', flags: { operational: true, closedOrError: false }
      } } } } }
    })
    await flushPromises()
    expect(body().text()).toContain('Alpha: Ready')
    expect(input().element.value).toBe('Alice')
    expect(button('Start print').attributes('disabled')).toBeUndefined()
    await body().get('form').trigger('submit')
    expect(dialog().dialogStore.getOutput(DialogName.PrintAssignmentDialog)).toBe('Alice')
  })

  it('refreshes unreachable connections and exposes retryable failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    usePrinterStateStore().$patch({ socketStatesById: { 1: { api: 'noResponse', socket: 'closed' } } })
    vi.mocked(PrintersService.refreshSocket).mockRejectedValueOnce(new Error('Network unavailable'))
    await open([{ ...first, existingFile: false }])
    await input().setValue('Alice')
    expect(PrintersService.refreshSocket).toHaveBeenCalledWith(1)
    expect(PrintersService.sendPrinterConnectCommand).not.toHaveBeenCalled()
    expect(body().text()).toContain('Could not reconnect the printer')
    expect(button('Start print').attributes('disabled')).toBeDefined()
    await button('Reconnect').trigger('click')
    await flushPromises()
    expect(PrintersService.refreshSocket).toHaveBeenCalledTimes(2)
    expect(body().text()).not.toContain('Could not reconnect the printer')
  })

  it('times out a reconnect without treating the command response as readiness', async () => {
    await open()
    vi.useFakeTimers()
    usePrinterStateStore().$patch({ socketStatesById: { 1: { socket: 'closed' } } })
    await flushPromises()
    expect(button('Reconnect')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(20000)
    expect(body().text()).toContain('Printer is still not ready')
    expect(button('Reconnect').attributes('disabled')).toBeUndefined()
    expect(button('Start print').attributes('disabled')).toBeDefined()
  })

  it('requires every batch target to be ready and reacts if a ready printer goes offline', async () => {
    await open([first, second])
    await input().setValue('Alice')
    expect(button('Start print').attributes('disabled')).toBeUndefined()
    usePrinterStateStore().$patch({ socketStatesById: { 2: { api: 'noResponse' } } })
    await flushPromises()
    expect(body().text()).toContain('Bravo: API unreachable')
    expect(body().findAll('button[aria-label^="Reconnect"]')).toHaveLength(0)
    expect(body().text()).toContain('All printers must be connected')
    expect(button('Start print').attributes('disabled')).toBeDefined()
    expect(PrintersService.refreshSocket).toHaveBeenCalledWith(2)
    expect(PrintersService.refreshSocket).toHaveBeenCalledTimes(1)
  })

  it.each(['printing', 'paused', 'cancelling', 'starting', 'updating'] as const)(
    'blocks a %s printer without offering to reconnect a busy printer', async flag => {
      usePrinterStateStore().$patch({
        printerEventsById: { 1: { current: { payload: { state: { flags: { [flag]: true } } } } } }
      })
      await open()
      await input().setValue('Alice')
      expect(body().text()).toContain('Alpha: Busy')
      expect(button('Start print').attributes('disabled')).toBeDefined()
      expect(button('Reconnect')).toBeUndefined()
    }
  )

  it('blocks disabled, missing, and unknown printers instead of assuming readiness', async () => {
    usePrinterStore().printers[0].enabled = false
    await open()
    await input().setValue('Alice')
    expect(body().text()).toContain('Alpha: Disabled')
    expect(button('Reconnect')).toBeUndefined()
    expect(button('Start print').attributes('disabled')).toBeDefined()
    usePrinterStore().printers = []
    await flushPromises()
    expect(body().text()).toContain('Printer unavailable')
    expect(button('Start print').attributes('disabled')).toBeDefined()
  })

  it('uses status refresh for printers without serial reconnect support', async () => {
    usePrinterStore().printers[0].printerType = MoonrakerType
    usePrinterStateStore().$patch({
      printerEventsById: { 1: { current: { payload: { state: { flags: { operational: false } } } } } }
    })
    await open()
    expect(PrintersService.refreshSocket).toHaveBeenCalledWith(1)
    expect(PrintersService.sendPrinterConnectCommand).not.toHaveBeenCalled()
  })

  it('refreshes an unknown state rather than issuing a serial connect without printer status', async () => {
    delete usePrinterStateStore().printerEventsById[1]
    await open()
    await input().setValue('Alice')
    expect(button('Start print').attributes('disabled')).toBeDefined()
    expect(PrintersService.refreshSocket).toHaveBeenCalledWith(1)
    expect(PrintersService.sendPrinterConnectCommand).not.toHaveBeenCalled()
  })

  it('ignores a timed-out command failure after a newer retry has started', async () => {
    let reject!: (reason: Error) => void
    vi.mocked(PrintersService.refreshSocket).mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
    usePrinterStateStore().$patch({ socketStatesById: { 1: { api: 'noResponse' } } })
    vi.useFakeTimers()
    await open()
    await vi.advanceTimersByTimeAsync(20000)
    await button('Reconnect').trigger('click')
    await flushPromises()
    reject(new Error('Stale failed command'))
    await flushPromises()
    expect(body().text()).toContain('Waiting for live printer status')
    expect(body().text()).not.toContain('Could not reconnect')
    expect(body().text()).not.toContain('Printer is still not ready')
  })

  it('ignores reconnect results and clears timers when cancelled and reopened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let reject!: (reason: Error) => void
    vi.mocked(PrintersService.refreshSocket).mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
    usePrinterStateStore().$patch({ socketStatesById: { 1: { api: 'noResponse' } } })
    vi.useFakeTimers()
    await open()
    await button('Cancel').trigger('click')
    await open([second])
    reject(new Error('Stale failure'))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(21000)
    expect(body().text()).not.toContain('Could not reconnect')
    expect(body().text()).not.toContain('still not ready')
    expect(body().text()).toContain('Bravo: Ready')
  })

  it('shows print details, requires a trimmed name, and returns it only after confirmation', async () => {
    await open()
    expect(body().text()).toContain('folder/test.gcode')
    expect(body().text()).toContain('Alpha')
    expect(button('Start print').attributes('disabled')).toBeDefined()
    await input().setValue('   ')
    expect(button('Start print').attributes('disabled')).toBeDefined()
    await input().setValue('x'.repeat(101))
    expect(button('Start print').attributes('disabled')).toBeDefined()
    await input().setValue('  Alice  ')
    await body().get('form').trigger('submit')
    await flushPromises()
    expect(dialog().isDialogOpened()).toBe(false)
    expect(dialog().dialogStore.getOutput(DialogName.PrintAssignmentDialog)).toBe('Alice')
  })

  it('prefills only from the exact file path on the same printer and leaves it editable', async () => {
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockResolvedValue([
      { fileName: 'test.gcode', startedAt: '2026-01-01', assignedTo: 'Wrong folder' },
      { fileName: first.fileName, startedAt: '2026-01-01', assignedTo: 'Alice' }
    ])
    await open()
    expect(PrinterRemoteFileService.getLastPrintStarts).toHaveBeenCalledWith(1)
    expect(input().element.value).toBe('Alice')
    await input().setValue('Bob')
    await body().get('form').trigger('submit')
    expect(dialog().dialogStore.getOutput(DialogName.PrintAssignmentDialog)).toBe('Bob')
  })

  it('uses one shared prefill only when all batch names agree', async () => {
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockImplementation(async printerId => [
      { fileName: printerId === 1 ? first.fileName : second.fileName, startedAt: '2026-01-01', assignedTo: 'Alice' }
    ])
    await open([first, second])
    expect(input().element.value).toBe('Alice')
    expect(body().text()).toContain('all 2 prints')
    await button('Cancel').trigger('click')
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockImplementation(async printerId => [
      { fileName: printerId === 1 ? first.fileName : second.fileName, startedAt: '2026-01-01', assignedTo: printerId === 1 ? 'Alice' : 'Bob' }
    ])
    await open([first, second])
    expect(input().element.value).toBe('')
  })

  it('does not suggest an older person when the latest print has no assignment', async () => {
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockResolvedValue([
      { fileName: first.fileName, startedAt: '2026-01-01', assignedTo: null }
    ])
    await open()
    expect(input().element.value).toBe('')
  })

  it('does not fetch history for a new upload', async () => {
    await open([{ ...first, existingFile: false }])
    expect(PrinterRemoteFileService.getLastPrintStarts).not.toHaveBeenCalled()
    expect(input().element.value).toBe('')
  })

  it('reports suggestion errors while allowing a manually entered name', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockRejectedValueOnce(new Error('Unavailable'))
    await open()
    expect(body().text()).toContain('Could not load previous assignments')
    await input().setValue('Alice')
    await body().get('form').trigger('submit')
    expect(dialog().dialogStore.getOutput(DialogName.PrintAssignmentDialog)).toBe('Alice')
  })

  it('ignores a cancelled request when reopening for another file', async () => {
    let resolve!: (value: { fileName: string; startedAt: string; assignedTo: string }[]) => void
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockReturnValueOnce(new Promise(done => { resolve = done }))
    await open()
    await button('Cancel').trigger('click')
    expect(dialog().dialogStore.getOutput(DialogName.PrintAssignmentDialog)).toBeNull()
    await open([{ ...second, existingFile: false }])
    resolve([{ fileName: first.fileName, startedAt: '2026-01-01', assignedTo: 'Stale name' }])
    await flushPromises()
    expect(input().element.value).toBe('')
  })

  it('is bypassed when disabled and cancellation returns no assignment', async () => {
    useSettingsStore().$patch({ settings: { server: {
      printAssignmentEnabled: false, checkPrinterStatusBeforePrint: false
    } } })
    expect(await confirmPrintAssignment([first])).toBeUndefined()
    useSettingsStore().$patch({ settings: { server: { printAssignmentEnabled: true } } })
    const result = confirmPrintAssignment([first])
    await flushPromises()
    await button('Cancel').trigger('click')
    expect(await result).toBeNull()
  })

  it('uses singular readiness wording for one printer and deduplicates auto reconnects', async () => {
    usePrinterStateStore().$patch({ socketStatesById: { 1: { api: 'noResponse' } } })
    await open([first, { ...first, fileName: 'other.gcode' }])
    expect(body().text()).toContain('The printer must be connected')
    expect(body().text()).not.toContain('All printers must')
    expect(PrintersService.refreshSocket).toHaveBeenCalledTimes(1)
    usePrinterStateStore().$patch({ socketStatesById: { 1: { socket: 'closed' } } })
    await flushPromises()
    expect(PrintersService.refreshSocket).toHaveBeenCalledTimes(1)
    expect(button('Reconnect')).toBeUndefined()
  })

  it('does not check status or reconnect when only person assignment is enabled', async () => {
    useSettingsStore().$patch({ settings: { server: { checkPrinterStatusBeforePrint: false } } })
    usePrinterStateStore().$patch({ socketStatesById: { 1: { api: 'noResponse' } } })
    await open()
    expect(body().find('[role="status"]').exists()).toBe(false)
    expect(PrintersService.refreshSocket).not.toHaveBeenCalled()
    await input().setValue('Alice')
    expect(button('Start print').attributes('disabled')).toBeUndefined()
    await body().get('form').trigger('submit')
    expect(dialog().dialogStore.getOutput(DialogName.PrintAssignmentDialog)).toBe('Alice')
  })

  it('offers manual recovery if a successful automatic reconnect is lost again', async () => {
    usePrinterStateStore().$patch({ socketStatesById: { 1: { api: 'noResponse' } } })
    await open()
    expect(PrintersService.refreshSocket).toHaveBeenCalledTimes(1)
    usePrinterStateStore().$patch({ socketStatesById: { 1: { api: 'responding' } } })
    await flushPromises()
    expect(body().text()).toContain('Alpha: Ready')
    usePrinterStateStore().$patch({ socketStatesById: { 1: { api: 'noResponse' } } })
    await flushPromises()
    expect(PrintersService.refreshSocket).toHaveBeenCalledTimes(1)
    expect(body().text()).toContain('Printer connection was lost again')
    expect(button('Reconnect')).toBeDefined()
  })

  it('checks status independently without a name or assignment-history requests', async () => {
    useSettingsStore().$patch({ settings: { server: { printAssignmentEnabled: false } } })
    const result = confirmPrintAssignment([first])
    await flushPromises()
    expect(body().text()).toContain('Check printer status')
    expect(body().find('input[aria-label="Assigned to"]').exists()).toBe(false)
    expect(PrinterRemoteFileService.getLastPrintStarts).not.toHaveBeenCalled()
    expect(button('Start print').attributes('disabled')).toBeUndefined()
    await body().get('form').trigger('submit')
    expect(await result).toBeUndefined()
  })

  it('allows cancellation of a status-only confirmation', async () => {
    useSettingsStore().$patch({ settings: { server: { printAssignmentEnabled: false } } })
    const result = confirmPrintAssignment([first])
    await flushPromises()
    await button('Cancel').trigger('click')
    expect(await result).toBeNull()
  })
})
