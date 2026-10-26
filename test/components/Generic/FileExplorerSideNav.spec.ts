import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FileExplorerSideNav from '@/components/Generic/FileExplorerSideNav.vue'
import AdvancedFileList from '@/components/Files/AdvancedFileList.vue'
import { usePrinterStore } from '@/store/printer.store'
import { useSettingsStore } from '@/store/settings.store'
import { useFileExplorer } from '@/shared/file-explorer.composable'
import type { PrinterDto } from '@/models/printers/printer.model'
import type { FileDto } from '@/models/printers/printer-file.model'

const printer: PrinterDto = {
  id: 1, name: 'Test printer', printerType: 0, enabled: true, dateAdded: 0,
  disabledReason: '', webSocketURL: '', apiKey: '', username: '', password: '',
  printerURL: 'http://127.0.0.1'
}
const files: FileDto[] = [
  { path: 'zebra.gcode', size: 1024, date: null, dir: false },
  { path: 'alpha.gcode', size: 2048, date: null, dir: false },
  { path: 'folder', size: null, date: null, dir: true }
]

function render() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useFileExplorer().closeFileExplorer()
  const printers = usePrinterStore()
  printers.printers = [printer]
  vi.spyOn(printers, 'loadPrinterFiles').mockResolvedValue(files)
  const settings = useSettingsStore()
  const wrapper = shallowMount(FileExplorerSideNav, {
    global: {
      plugins: [pinia],
      renderStubDefaultSlot: true,
      stubs: {
        VVirtualScroll: {
          props: ['items'],
          template: '<div><slot v-for="item in items" :item="item" /></div>'
        }
      }
    }
  })
  return { wrapper, printers, settings }
}

afterEach(() => {
  useFileExplorer().closeFileExplorer()
  vi.restoreAllMocks()
})

describe('FileExplorerSideNav advanced file list gating', () => {
  it('keeps the original search and folders-first alphabetical list when unconfigured', async () => {
    const { wrapper } = render()
    useFileExplorer().openFileExplorer(printer)
    await flushPromises()
    expect(wrapper.findComponent(AdvancedFileList).exists()).toBe(false)
    expect(wrapper.find('[placeholder="Search files..."]').exists()).toBe(true)
    const text = wrapper.text()
    expect(text.indexOf('folder')).toBeLessThan(text.indexOf('alpha.gcode'))
    expect(text.indexOf('alpha.gcode')).toBeLessThan(text.indexOf('zebra.gcode'))
    expect(text).not.toContain('Last print started')
    wrapper.unmount()
  })

  it('renders only the advanced list when enabled and restores the normal list when disabled', async () => {
    const { wrapper, settings } = render()
    settings.$patch({
      settings: {
        server: {
          advancedFileListEnabled: true,
          advancedFileListColumns: { size: false, startedAt: true },
          loginRequired: false,
          registration: false,
          sentryDiagnosticsEnabled: false,
          experimentalMoonrakerSupport: false,
          experimentalPrusaLinkSupport: false,
          experimentalBambuSupport: false
        }
      }
    })
    useFileExplorer().openFileExplorer(printer)
    await flushPromises()
    expect(wrapper.findComponent(AdvancedFileList).props('files')).toEqual(files)
    expect(wrapper.findComponent(AdvancedFileList).props('columns')).toEqual({ size: false, startedAt: true })
    expect(wrapper.find('[placeholder="Search files..."]').exists()).toBe(false)
    settings.$patch({ settings: { server: { advancedFileListEnabled: false } } })
    await flushPromises()
    expect(wrapper.findComponent(AdvancedFileList).exists()).toBe(false)
    expect(wrapper.find('[placeholder="Search files..."]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not replace the current printer files with an older request', async () => {
    const { wrapper, printers } = render()
    let resolveOld!: (value: FileDto[]) => void
    vi.mocked(printers.loadPrinterFiles)
      .mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce([{ ...files[0], path: 'second-printer.gcode' }])
    useFileExplorer().openFileExplorer(printer)
    await flushPromises()
    useFileExplorer().openFileExplorer({ ...printer, id: 2 })
    await flushPromises()
    resolveOld(files)
    await flushPromises()
    expect(wrapper.text()).toContain('second-printer.gcode')
    expect(wrapper.text()).not.toContain('alpha.gcode')
    wrapper.unmount()
  })
})
