import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import AdvancedFileList from '@/components/Files/AdvancedFileList.vue'
import { PrinterRemoteFileService } from '@/backend/printer-remote-file.service'
import type { FileDto, LastPrintStartDto } from '@/models/printers/printer-file.model'

vi.mock('@/backend/printer-remote-file.service', () => ({
  PrinterRemoteFileService: { getLastPrintStarts: vi.fn() }
}))

const files: FileDto[] = [
  { path: 'zebra.gcode', size: 1024, date: null, dir: false },
  { path: 'alpha.gcode', size: 2048, date: null, dir: false },
  { path: 'never.gcode', size: 4096, date: null, dir: false },
  { path: 'folder', size: null, date: null, dir: true }
]
const starts: LastPrintStartDto[] = [
  { fileName: 'zebra.gcode', startedAt: '2026-02-01T12:34:00Z' },
  { fileName: 'alpha.gcode', startedAt: '2026-10-01T14:45:00Z' }
]

function render(props = {}) {
  return mount(AdvancedFileList, {
    props: { files, printerId: 1, ...props },
    global: { plugins: [createVuetify()] }
  })
}

function displayedNames(wrapper: ReturnType<typeof render>) {
  return wrapper.findAll('tbody tr')
    .filter(row => row.find('[aria-label="Download file"]').exists())
    .map(row => row.find('td').text())
}

async function sortColumn(wrapper: ReturnType<typeof render>, title: string) {
  const header = wrapper.findAll('thead th').find(th => th.text().includes(title))
  if (!header) throw new Error(`Missing column ${title}`)
  await header.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockResolvedValue(starts)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdvancedFileList', () => {
  it('sorts names, numeric sizes, and actual print timestamps in both directions', async () => {
    const wrapper = render()
    await flushPromises()
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode', 'never.gcode', 'zebra.gcode'])
    await sortColumn(wrapper, 'Name')
    expect(displayedNames(wrapper)).toEqual(['zebra.gcode', 'never.gcode', 'alpha.gcode'])
    await sortColumn(wrapper, 'Size')
    expect(displayedNames(wrapper)).toEqual(['zebra.gcode', 'alpha.gcode', 'never.gcode'])
    await sortColumn(wrapper, 'Size')
    expect(displayedNames(wrapper)).toEqual(['never.gcode', 'alpha.gcode', 'zebra.gcode'])
    await sortColumn(wrapper, 'Last print started')
    expect(displayedNames(wrapper).filter(name => name !== 'never.gcode')).toEqual(['zebra.gcode', 'alpha.gcode'])
    await sortColumn(wrapper, 'Last print started')
    expect(displayedNames(wrapper).filter(name => name !== 'never.gcode')).toEqual(['alpha.gcode', 'zebra.gcode'])
    wrapper.unmount()
  })

  it('uses one case-insensitive search across names, sizes, and dates and supports clearing', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('input')).toHaveLength(1)
    const search = wrapper.get('input[aria-label="Search files"]')
    await search.setValue(' ALPHA ')
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode'])
    await search.setValue('2 KB')
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode'])
    await search.setValue('2048')
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode'])
    await search.setValue('2026-10-01')
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode'])
    await search.setValue('no matching files')
    expect(displayedNames(wrapper)).toEqual([])
    await search.setValue('2026-02-01')
    expect(displayedNames(wrapper)).toEqual(['zebra.gcode'])
    await search.setValue('Not recorded')
    expect(displayedNames(wrapper)).toEqual(['never.gcode'])
    await search.setValue('')
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode', 'never.gcode', 'zebra.gcode'])
    wrapper.unmount()
  })

  it('shows the local date, the time on hover, and an explicit missing-history label', async () => {
    const wrapper = render()
    await flushPromises()
    const started = new Date(starts[0].startedAt)
    const date = wrapper.findAll('span[title]').find(span => span.attributes('title') === started.toLocaleString())
    expect(date?.text()).toBe(started.toLocaleDateString())
    expect(wrapper.text()).toContain('Not recorded')
    wrapper.unmount()
  })

  it('keeps folder navigation and file actions, protecting the currently printing file', async () => {
    const wrapper = render({ currentPrintingFilePath: 'alpha.gcode' })
    await flushPromises()
    await wrapper.get('button[title="folder"]').trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([['folder']])

    const rows = wrapper.findAll('tbody tr')
    const active = rows.find(row => row.text().includes('alpha.gcode'))!
    expect(active.get('[aria-label="Print file"]').attributes('disabled')).toBeDefined()
    expect(active.get('[aria-label="Delete file"]').attributes('disabled')).toBeDefined()
    const idle = rows.find(row => row.text().includes('zebra.gcode'))!
    await idle.get('[aria-label="Download file"]').trigger('click')
    await idle.get('[aria-label="Print file"]').trigger('click')
    await idle.get('[aria-label="Delete file"]').trigger('click')
    expect(wrapper.emitted('download')).toEqual([['zebra.gcode']])
    expect(wrapper.emitted('print')).toEqual([[files[0]]])
    expect(wrapper.emitted('delete')).toEqual([[files[0]]])
    wrapper.unmount()
  })

  it('does not assign history by basename to a different folder', async () => {
    const wrapper = render({
      files: [{ ...files[0], path: 'folder/zebra.gcode' }]
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Not recorded')
    wrapper.unmount()
  })

  it('reloads history after refreshing files without resetting sort or search', async () => {
    const wrapper = render()
    await flushPromises()
    await sortColumn(wrapper, 'Last print started')
    await sortColumn(wrapper, 'Last print started')
    await wrapper.get('input[aria-label="Search files"]').setValue('.gcode')
    await wrapper.setProps({ files: [...files] })
    await flushPromises()
    expect(PrinterRemoteFileService.getLastPrintStarts).toHaveBeenLastCalledWith(1)
    expect(displayedNames(wrapper).filter(name => name !== 'never.gcode')).toEqual(['alpha.gcode', 'zebra.gcode'])
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Search files"]').element.value).toBe('.gcode')
    wrapper.unmount()
  })

  it('surfaces history errors and supports retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts).mockRejectedValueOnce(new Error('Network unavailable'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('Could not load print start dates')
    expect(wrapper.text()).toContain('Unavailable')
    const retry = wrapper.findAll('button').find(button => button.text() === 'Retry')!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Could not load print start dates')
    expect(wrapper.text()).toContain(new Date(starts[0].startedAt).toLocaleDateString())
    wrapper.unmount()
  })

  it('ignores a stale response after switching printers', async () => {
    let resolveOld!: (value: LastPrintStartDto[]) => void
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts)
      .mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce([])
    const wrapper = render()
    await wrapper.setProps({ printerId: 2 })
    await flushPromises()
    resolveOld(starts)
    await flushPromises()
    expect(wrapper.text()).toContain('Not recorded')
    expect(wrapper.findAll('span[title]').some(span =>
      span.attributes('title') === new Date(starts[0].startedAt).toLocaleString()
    )).toBe(false)
    wrapper.unmount()
  })

  it('hides optional columns and excludes their values from search', async () => {
    const wrapper = render()
    await flushPromises()
    const search = wrapper.get('input[aria-label="Search files"]')
    await search.setValue('2 KB')
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode'])
    await wrapper.setProps({ columns: { size: false, startedAt: true } })
    expect(displayedNames(wrapper)).toEqual([])
    expect(wrapper.findAll('thead th').map(th => th.text())).not.toContain('Size')
    await search.setValue('2026-10-01')
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode'])
    await wrapper.setProps({ columns: { size: false, startedAt: false } })
    expect(displayedNames(wrapper)).toEqual([])
    expect(wrapper.findAll('thead th').map(th => th.text())).toEqual(['Name', 'Actions'])
    await search.setValue('alpha')
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode'])
    wrapper.unmount()
  })

  it('does not request hidden print dates and reloads them when shown', async () => {
    const wrapper = render({ columns: { size: true, startedAt: false } })
    await flushPromises()
    expect(PrinterRemoteFileService.getLastPrintStarts).not.toHaveBeenCalled()
    await wrapper.setProps({ columns: { size: true, startedAt: true } })
    await flushPromises()
    expect(PrinterRemoteFileService.getLastPrintStarts).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain(new Date(starts[0].startedAt).toLocaleDateString())
    wrapper.unmount()
  })

  it('resets sorting to Name when the sorted column is hidden', async () => {
    const wrapper = render()
    await flushPromises()
    await sortColumn(wrapper, 'Size')
    expect(displayedNames(wrapper)).toEqual(['zebra.gcode', 'alpha.gcode', 'never.gcode'])
    await wrapper.setProps({ columns: { size: false, startedAt: true } })
    await flushPromises()
    expect(displayedNames(wrapper)).toEqual(['alpha.gcode', 'never.gcode', 'zebra.gcode'])
    wrapper.unmount()
  })

  it('ignores pending print dates if their column is hidden', async () => {
    let resolveHistory!: (value: LastPrintStartDto[]) => void
    vi.mocked(PrinterRemoteFileService.getLastPrintStarts)
      .mockReturnValueOnce(new Promise(resolve => { resolveHistory = resolve }))
    const wrapper = render()
    await wrapper.setProps({ columns: { size: true, startedAt: false } })
    resolveHistory(starts)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Last print started')
    expect(wrapper.findComponent({ name: 'VDataTableVirtual' }).props('loading')).toBe(false)
    wrapper.unmount()
  })
})
