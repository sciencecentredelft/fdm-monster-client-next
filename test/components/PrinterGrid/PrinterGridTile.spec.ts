import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrinterGridTile from '@/components/PrinterGrid/PrinterGridTile.vue'
import { usePrinterStore } from '@/store/printer.store'
import { usePrinterStateStore } from '@/store/printer-state.store'
import { useSettingsStore } from '@/store/settings.store'
import { useProfileStore } from '@/store/profile.store'
import type { PrinterDto } from '@/models/printers/printer.model'
import { defaultGridStatusColors, gridStatusTextColor, type GridStatus } from '@/shared/grid-status-colors'
import type { CurrentOrHistoryPayload } from '@/models/printers/printer-current-job.model'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/queries/printer-tile-thumbnail.query', () => ({
  usePrinterTileThumbnailQuery: () => ({ data: ref('') })
}))

const printer: PrinterDto = {
  id: 1, name: 'Alpha', printerType: 0, enabled: true, dateAdded: 0,
  disabledReason: '', webSocketURL: '', apiKey: '', username: '', password: '',
  printerURL: 'http://127.0.0.1'
}
let wrapper: ReturnType<typeof shallowMount>

beforeEach(() => {
  setActivePinia(createPinia())
  usePrinterStore().printers = [printer]
  usePrinterStateStore().$patch({
    printerIds: [1],
    socketStatesById: { 1: { api: 'responding', socket: 'authenticated' } },
    printerEventsById: {
      1: {
        currentPrintAssignment: { fileName: 'folder/test.gcode', assignedTo: 'Alice' },
        current: {
          receivedAt: Date.now(),
          payload: {
            state: { text: 'Printing', flags: { printing: true, paused: false, operational: true } },
            job: { file: { path: 'folder/test.gcode', name: 'test.gcode', display: 'test.gcode' } }
          }
        }
      }
    }
  })
  wrapper = shallowMount(PrinterGridTile, {
    props: { printer, x: 0, y: 0 },
    global: {
      renderStubDefaultSlot: true,
      directives: { 'drop-printer-position': {}, 'drop-upload': {} }
    }
  })
})

afterEach(() => { wrapper.unmount() })

describe('printer grid assignee', () => {
  it('only permits administrators to rearrange printers or open their settings', async () => {
    expect(wrapper.get('v-card-stub').attributes('draggable')).toBe('false')
    expect(wrapper.text()).not.toContain('Open printer settings')
    expect(wrapper.text()).toContain('Move and home printer')
    expect(wrapper.text()).toContain('Files')
    useProfileStore().roles = ['ADMIN']
    await nextTick()
    expect(wrapper.get('v-card-stub').attributes('draggable')).toBe('true')
    expect(wrapper.text()).toContain('Open printer settings')
    useProfileStore().roles = ['OPERATOR']
    await nextTick()
    expect(wrapper.text()).not.toContain('Open printer settings')
  })

  it('is hidden by default and updates immediately when the display setting changes', async () => {
    expect(wrapper.find('.print-assignee').exists()).toBe(false)
    useSettingsStore().$patch({ settings: { server: { showPrintAssigneeOnGrid: true } } })
    await nextTick()
    expect(wrapper.get('.print-assignee').text()).toBe('Assigned to: Alice')
    expect(wrapper.get('.print-assignee').attributes('title')).toBe('Assigned to: Alice')
    useSettingsStore().$patch({ settings: { server: { showPrintAssigneeOnGrid: false } } })
    await nextTick()
    expect(wrapper.find('.print-assignee').exists()).toBe(false)
  })

  describe('printer grid status colours', () => {
    const card = () => wrapper.get('v-card-stub')
    it('leaves the original appearance unchanged by default and restores it when disabled', async () => {
      expect(card().attributes('style') ?? '').not.toContain('background-color')
      useSettingsStore().$patch({ settings: { server: {
        gridStatusColorsEnabled: true, gridStatusColors: { ...defaultGridStatusColors, printing: '#FFFFFF' }
      } } })
      await nextTick()
      expect(card().attributes('style')).toContain('background-color: rgb(255, 255, 255)')
      expect(card().attributes('style')).toContain('--grid-status-text-color: #000000')
      usePrinterStore().toggleSelectedPrinter(printer)
      await nextTick()
      expect(card().classes()).toContain('tile-selected')
      expect(card().classes()).toContain('tile-status-colored')
      useSettingsStore().$patch({ settings: { server: { gridStatusColorsEnabled: false } } })
      await nextTick()
      expect(card().attributes('style') ?? '').not.toContain('background-color')
      expect(card().classes()).not.toContain('tile-status-colored')
    })

    const cases: {
      status: GridStatus
      flags?: Partial<CurrentOrHistoryPayload['state']['flags']>
      api?: string
      socket?: string
      enabled?: boolean
      reason?: string
      missingEvents?: boolean
    }[] = [
      { status: 'ready', flags: { operational: true } },
      { status: 'printing', flags: { printing: true } },
      { status: 'printing', flags: { starting: true } },
      { status: 'paused', flags: { printing: true, paused: true } },
      { status: 'paused', flags: { pausing: true } },
      { status: 'offline', api: 'noResponse', flags: { printing: true } },
      { status: 'offline', flags: { closedOrError: true } },
      { status: 'offline', socket: 'closed' },
      { status: 'offline', socket: 'aborted' },
      { status: 'connecting', socket: 'authenticating' },
      { status: 'connecting', api: 'unset' },
      { status: 'connecting', flags: { updating: true } },
      { status: 'connecting', missingEvents: true },
      { status: 'error', flags: { error: true, closedOrError: true } },
      { status: 'error', api: 'authFail' },
      { status: 'error', api: 'globalKey' },
      { status: 'error', socket: 'error' },
      { status: 'disabled', enabled: false, api: 'noResponse' },
      { status: 'maintenance', enabled: false, reason: 'Repairing', flags: { error: true } }
    ]
    it.each(cases)('uses the $status colour for $flags $api $socket', async target => {
      useSettingsStore().$patch({ settings: { server: { gridStatusColorsEnabled: true } } })
      const store = usePrinterStateStore()
      store.$patch({
        socketStatesById: { 1: { api: target.api ?? 'responding', socket: target.socket ?? 'authenticated' } },
        printerEventsById: { 1: { current: { payload: { state: {
          flags: { printing: false, paused: false, operational: false, ...target.flags }
        } } } } }
      })
      if (target.missingEvents) delete store.printerEventsById[1]
      await wrapper.setProps({ printer: { ...printer, enabled: target.enabled ?? true, disabledReason: target.reason ?? '' } })
      await nextTick()
      const style = card().element.getAttribute('style')!
      const expected = document.createElement('div')
      expected.style.backgroundColor = defaultGridStatusColors[target.status]
      expect(style).toContain(`background-color: ${expected.style.backgroundColor}`)
    })

    it('never colours empty grid slots', async () => {
      useSettingsStore().$patch({ settings: { server: { gridStatusColorsEnabled: true } } })
      await wrapper.setProps({ printer: undefined })
      expect(card().classes()).not.toContain('tile-status-colored')
      expect(card().attributes('style') ?? '').not.toContain('background-color')
    })

    it('chooses text with at least 4.5:1 contrast for defaults and custom colours', () => {
      const luminance = (hex: string) => {
        const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
          .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
      }
      for (const color of [...Object.values(defaultGridStatusColors), '#FFFFFF', '#000000', '#777777', '#ABCDEF', '#FFFF00']) {
        const background = luminance(color)
        const text = luminance(gridStatusTextColor(color))
        expect((Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05)).toBeGreaterThanOrEqual(4.5)
      }
    })
  })

  it('shows paused prints but hides the name when idle, offline, or disabled', async () => {
    useSettingsStore().$patch({ settings: { server: { showPrintAssigneeOnGrid: true } } })
    const state = usePrinterStateStore()
    state.$patch({ printerEventsById: { 1: { current: { payload: { state: { flags: { printing: false, paused: true } } } } } } })
    await nextTick()
    expect(wrapper.get('.print-assignee').text()).toContain('Alice')
    state.$patch({ printerEventsById: { 1: { current: { payload: { state: { flags: { paused: false } } } } } } })
    await nextTick()
    expect(wrapper.find('.print-assignee').exists()).toBe(false)
    state.$patch({ printerEventsById: { 1: { current: { payload: { state: { flags: { printing: true } } } } } } })
    state.socketStatesById[1].api = 'noResponse'
    await nextTick()
    expect(wrapper.find('.print-assignee').exists()).toBe(false)
    state.socketStatesById[1].api = 'responding'
    await wrapper.setProps({ printer: { ...printer, enabled: false } })
    expect(wrapper.find('.print-assignee').exists()).toBe(false)
  })

  it('never shows another file or printer assignment and clears unassigned runs', async () => {
    useSettingsStore().$patch({ settings: { server: { showPrintAssigneeOnGrid: true } } })
    const state = usePrinterStateStore()
    state.$patch({ printerEventsById: { 1: { currentPrintAssignment: { fileName: 'other/test.gcode', assignedTo: 'Wrong person' } } } })
    await nextTick()
    expect(wrapper.find('.print-assignee').exists()).toBe(false)
    state.$patch({ printerEventsById: { 1: { currentPrintAssignment: { fileName: 'folder/test.gcode', assignedTo: null } } } })
    await nextTick()
    expect(wrapper.find('.print-assignee').exists()).toBe(false)
    state.$patch({ printerEventsById: { 1: { currentPrintAssignment: { assignedTo: 'Bob' } } } })
    await nextTick()
    expect(wrapper.get('.print-assignee').text()).toContain('Bob')
    await wrapper.setProps({ printer: { ...printer, id: 2 } })
    expect(wrapper.find('.print-assignee').exists()).toBe(false)
  })
})
