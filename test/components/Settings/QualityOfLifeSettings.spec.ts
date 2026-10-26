import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import QualityOfLifeSettings from '@/components/Settings/QualityOfLifeSettings.vue'
import { SettingsService } from '@/backend'
import { useSettingsStore } from '@/store/settings.store'
import type { SettingsDto } from '@/models/settings/settings.model'
import type { AdvancedFileListColumns } from '@/models/settings/server-settings.dto'
import { defaultGridStatusColors } from '@/shared/grid-status-colors'

vi.mock('@/backend', () => ({
  SettingsService: {
    getSettings: vi.fn(),
    updateAdvancedFileList: vi.fn(),
    updatePrintAssignment: vi.fn(),
    updatePrintAssigneeGrid: vi.fn(),
    updatePrePrintStatusCheck: vi.fn(),
    updateGridStatusColors: vi.fn(),
    updateFloorGridLock: vi.fn()
  }
}))

function settings(enabled?: boolean, columns?: AdvancedFileListColumns): SettingsDto {
  return {
    server: {
      loginRequired: false,
      registration: false,
      sentryDiagnosticsEnabled: false,
      experimentalMoonrakerSupport: false,
      experimentalPrusaLinkSupport: false,
      experimentalBambuSupport: false,
      advancedFileListEnabled: enabled,
      advancedFileListColumns: columns
    },
    frontend: { gridCols: 8, gridRows: 8, largeTiles: false, tilePreferCancelOverQuickStop: false },
    timeout: { apiTimeout: 10000, apiUploadTimeout: 30000 },
    wizard: { wizardCompleted: true, wizardVersion: 1, latestWizardVersion: 1 }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(SettingsService.getSettings).mockResolvedValue(settings())
  vi.mocked(SettingsService.updateAdvancedFileList).mockImplementation(async (enabled, columns) => settings(enabled, columns))
})

afterEach(() => { vi.restoreAllMocks() })

describe('QualityOfLifeSettings', () => {
  it('defaults floor grid locks off, saves independently, and rolls back failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(SettingsService.updateFloorGridLock).mockImplementation(async enabled => ({
      ...settings(), server: { ...settings().server, floorGridLockEnabled: enabled }
    }))
    const pinia = createPinia()
    const wrapper = mount(QualityOfLifeSettings, { global: { plugins: [pinia, createVuetify()] } })
    await flushPromises()
    const toggle = wrapper.get<HTMLInputElement>('input[aria-label="Enable password locks for floor grid views"]')
    expect(toggle.element.checked).toBe(false)
    expect(wrapper.text()).not.toContain('Set a password per group')
    await toggle.setValue(true)
    await flushPromises()
    expect(SettingsService.updateFloorGridLock).toHaveBeenCalledWith(true)
    expect(useSettingsStore(pinia).serverSettings?.floorGridLockEnabled).toBe(true)
    expect(wrapper.text()).toContain('Set a password per group')
    vi.mocked(SettingsService.updateFloorGridLock).mockRejectedValueOnce(new Error('Offline'))
    await toggle.setValue(false)
    await flushPromises()
    expect(toggle.element.checked).toBe(true)
    expect(wrapper.text()).toContain('Could not save the floor grid lock setting')
    wrapper.unmount()
  })
  it('hides colour controls until enabled and preserves colours across toggles, errors, and reloads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(SettingsService.updateGridStatusColors).mockImplementation(async (enabled, colors) => ({
      ...settings(), server: { ...settings().server, gridStatusColorsEnabled: enabled, gridStatusColors: colors }
    }))
    const pinia = createPinia()
    const wrapper = mount(QualityOfLifeSettings, { global: { plugins: [pinia, createVuetify()] } })
    await flushPromises()
    const toggle = wrapper.get<HTMLInputElement>('input[aria-label="Colour-code printer grid cards"]')
    expect(toggle.element.checked).toBe(false)
    expect(wrapper.findAll('input[type="color"]')).toHaveLength(0)
    await toggle.setValue(true)
    await flushPromises()
    expect(wrapper.findAll('input[type="color"]')).toHaveLength(8)
    expect(SettingsService.updateGridStatusColors).toHaveBeenLastCalledWith(true, defaultGridStatusColors)
    await wrapper.get('input[aria-label="Printing colour"]').setValue('#123456')
    await flushPromises()
    expect(useSettingsStore(pinia).serverSettings?.gridStatusColors?.printing).toBe('#123456')
    vi.mocked(SettingsService.updateGridStatusColors).mockRejectedValueOnce(new Error('Offline'))
    await wrapper.get('input[aria-label="Printing colour"]').setValue('#abcdef')
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Printing colour"]').element.value).toBe('#123456')
    expect(wrapper.text()).toContain('Could not save the printer grid colours')
    await toggle.setValue(false)
    await flushPromises()
    expect(wrapper.findAll('input[type="color"]')).toHaveLength(0)
    await toggle.setValue(true)
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Printing colour"]').element.value).toBe('#123456')
    expect(SettingsService.updatePrintAssignment).not.toHaveBeenCalled()
    expect(SettingsService.updatePrePrintStatusCheck).not.toHaveBeenCalled()
    const saved = useSettingsStore(pinia).settings!
    wrapper.unmount()
    vi.mocked(SettingsService.getSettings).mockResolvedValue(saved)
    const reloaded = mount(QualityOfLifeSettings, { global: { plugins: [pinia, createVuetify()] } })
    await flushPromises()
    expect(reloaded.get<HTMLInputElement>('input[aria-label="Printing colour"]').element.value).toBe('#123456')
    reloaded.unmount()
  })
  it('saves the status check independently and restores it after a failed save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(SettingsService.updatePrePrintStatusCheck).mockImplementation(async enabled => ({
      ...settings(), server: { ...settings().server, checkPrinterStatusBeforePrint: enabled }
    }))
    const pinia = createPinia()
    const wrapper = mount(QualityOfLifeSettings, { global: { plugins: [pinia, createVuetify()] } })
    await flushPromises()
    const toggle = wrapper.get<HTMLInputElement>('input[aria-label="Check printer status before printing"]')
    expect(toggle.element.checked).toBe(false)
    await toggle.setValue(true)
    await flushPromises()
    expect(SettingsService.updatePrePrintStatusCheck).toHaveBeenCalledWith(true)
    expect(SettingsService.updatePrintAssignment).not.toHaveBeenCalled()
    expect(useSettingsStore(pinia).serverSettings?.checkPrinterStatusBeforePrint).toBe(true)
    vi.mocked(SettingsService.updatePrePrintStatusCheck).mockRejectedValueOnce(new Error('Offline'))
    await toggle.setValue(false)
    await flushPromises()
    expect(toggle.element.checked).toBe(true)
    expect(wrapper.text()).toContain('Could not save the pre-print status check setting')
    wrapper.unmount()
    vi.mocked(SettingsService.getSettings).mockResolvedValue({
      ...settings(), server: { ...settings().server, checkPrinterStatusBeforePrint: true }
    })
    const reloaded = mount(QualityOfLifeSettings, { global: { plugins: [pinia, createVuetify()] } })
    await flushPromises()
    expect(reloaded.get<HTMLInputElement>('input[aria-label="Check printer status before printing"]').element.checked).toBe(true)
    reloaded.unmount()
  })
  it('saves grid display independently and rolls back errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(SettingsService.updatePrintAssigneeGrid).mockImplementation(async enabled => ({
      ...settings(), server: { ...settings().server, showPrintAssigneeOnGrid: enabled }
    }))
    const pinia = createPinia()
    const wrapper = mount(QualityOfLifeSettings, { global: { plugins: [pinia, createVuetify()] } })
    await flushPromises()
    const grid = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')[2]
    expect(grid.element.checked).toBe(false)
    await grid.setValue(true)
    await flushPromises()
    expect(SettingsService.updatePrintAssigneeGrid).toHaveBeenCalledWith(true)
    expect(SettingsService.updatePrintAssignment).not.toHaveBeenCalled()
    expect(SettingsService.updateAdvancedFileList).not.toHaveBeenCalled()
    expect(useSettingsStore(pinia).serverSettings?.showPrintAssigneeOnGrid).toBe(true)
    vi.mocked(SettingsService.updatePrintAssigneeGrid).mockRejectedValueOnce(new Error('Offline'))
    await grid.setValue(false)
    await flushPromises()
    expect(grid.element.checked).toBe(true)
    expect(wrapper.text()).toContain('Could not save the grid assignee display setting')
    wrapper.unmount()
    vi.mocked(SettingsService.getSettings).mockResolvedValue({
      ...settings(), server: { ...settings().server, showPrintAssigneeOnGrid: true }
    })
    const reloaded = mount(QualityOfLifeSettings, { global: { plugins: [pinia, createVuetify()] } })
    await flushPromises()
    expect(reloaded.findAll<HTMLInputElement>('input[type="checkbox"]')[2].element.checked).toBe(true)
    reloaded.unmount()
  })

  it('defaults to disabled with the description and column controls hidden', async () => {
    const wrapper = mount(QualityOfLifeSettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const checkbox = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox.element.checked).toBe(false)
    expect(wrapper.text()).not.toContain('Enable Experimental')
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').map(input => input.element.checked))
      .toEqual([false, false, false, false, false, false])
    expect(wrapper.text()).not.toContain('Name and Actions are always shown')
    expect(wrapper.text()).not.toContain('Show sortable columns and one search field across visible columns.')
    expect(wrapper.text()).not.toContain('Sort')
    wrapper.unmount()
  })

  it('saves the toggle and updates the shared store immediately, including when disabling', async () => {
    const pinia = createPinia()
    const wrapper = mount(QualityOfLifeSettings, {
      global: { plugins: [pinia, createVuetify()] }
    })
    await flushPromises()
    const checkbox = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    await checkbox.setValue(true)
    await flushPromises()
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(true, { size: true, startedAt: true })
    expect(useSettingsStore(pinia).serverSettings?.advancedFileListEnabled).toBe(true)
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').map(input => input.element.checked))
      .toEqual([true, true, true, false, false, false, false, false, false])
    expect(wrapper.text()).toContain('Show sortable columns and one search field across visible columns.')
    await checkbox.setValue(false)
    await flushPromises()
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(false, { size: true, startedAt: true })
    expect(useSettingsStore(pinia).serverSettings?.advancedFileListEnabled).toBe(false)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(6)
    expect(wrapper.text()).not.toContain('Show sortable columns and one search field across visible columns.')
    wrapper.unmount()
  })

  it('reports a save error and restores the previous checkbox value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(SettingsService.updateAdvancedFileList).mockRejectedValueOnce(new Error('Network unavailable'))
    const wrapper = mount(QualityOfLifeSettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const checkbox = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    await checkbox.setValue(true)
    await flushPromises()
    expect(checkbox.element.checked).toBe(false)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(6)
    expect(wrapper.text()).toContain('Could not save the advanced file list setting')
    wrapper.unmount()
  })

  it('preserves saved column choices while hidden and restores them when re-enabled', async () => {
    vi.mocked(SettingsService.getSettings).mockResolvedValue(settings(false, { size: false, startedAt: true }))
    const pinia = createPinia()
    const wrapper = mount(QualityOfLifeSettings, {
      global: { plugins: [pinia, createVuetify()] }
    })
    await flushPromises()
    const enable = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(6)
    await enable.setValue(true)
    await flushPromises()
    const inputs = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(inputs.map(input => input.element.checked)).toEqual([true, false, true, false, false, false, false, false, false])
    await inputs[2].setValue(false)
    await flushPromises()
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(true, { size: false, startedAt: false })
    expect(useSettingsStore(pinia).serverSettings?.advancedFileListColumns).toEqual({ size: false, startedAt: false })
    await enable.setValue(false)
    await flushPromises()
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(6)
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(false, { size: false, startedAt: false })
    await enable.setValue(true)
    await flushPromises()
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(true, { size: false, startedAt: false })
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').map(input => input.element.checked))
      .toEqual([true, false, false, false, false, false, false, false, false])
    wrapper.unmount()
  })

  it('restores saved column choices on a failed save', async () => {
    vi.mocked(SettingsService.getSettings).mockResolvedValue(settings(true))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(SettingsService.updateAdvancedFileList).mockRejectedValueOnce(new Error('Network unavailable'))
    const wrapper = mount(QualityOfLifeSettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const size = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')[1]
    await size.setValue(false)
    await flushPromises()
    expect(size.element.checked).toBe(true)
    expect(wrapper.text()).toContain('Could not save')
    wrapper.unmount()
  })

  it('disables editing after a load error and supports retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(SettingsService.getSettings).mockRejectedValueOnce(new Error('Network unavailable'))
    const wrapper = mount(QualityOfLifeSettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').every(input => input.element.disabled)).toBe(true)
    expect(wrapper.text()).toContain('Could not load')
    await wrapper.findAll('button').find(button => button.text() === 'Retry')!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').every(input => !input.element.disabled)).toBe(true)
    wrapper.unmount()
  })

  it('saves assignment independently of the advanced file list and rolls back a failed toggle', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(SettingsService.updatePrintAssignment).mockImplementation(async enabled => ({
      ...settings(), server: { ...settings().server, printAssignmentEnabled: enabled }
    }))
    const pinia = createPinia()
    const wrapper = mount(QualityOfLifeSettings, { global: { plugins: [pinia, createVuetify()] } })
    await flushPromises()
    const assignment = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')[1]
    await assignment.setValue(true)
    await flushPromises()
    expect(SettingsService.updatePrintAssignment).toHaveBeenCalledWith(true)
    expect(SettingsService.updateAdvancedFileList).not.toHaveBeenCalled()
    expect(useSettingsStore(pinia).serverSettings?.printAssignmentEnabled).toBe(true)
    expect(useSettingsStore(pinia).serverSettings?.advancedFileListEnabled).not.toBe(true)
    vi.mocked(SettingsService.updatePrintAssignment).mockRejectedValueOnce(new Error('Unavailable'))
    await assignment.setValue(false)
    await flushPromises()
    expect(assignment.element.checked).toBe(true)
    expect(wrapper.text()).toContain('Could not save the print assignment setting')
    wrapper.unmount()
  })

  it('loads and saves the optional Assigned to column', async () => {
    vi.mocked(SettingsService.getSettings).mockResolvedValue(settings(true, { size: true, startedAt: false, assignedTo: true }))
    const wrapper = mount(QualityOfLifeSettings, { global: { plugins: [createPinia(), createVuetify()] } })
    await flushPromises()
    const assignmentColumn = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')[3]
    expect(assignmentColumn.element.checked).toBe(true)
    await assignmentColumn.setValue(false)
    await flushPromises()
    expect(SettingsService.updateAdvancedFileList).toHaveBeenCalledWith(true, { size: true, startedAt: false, assignedTo: false })
    wrapper.unmount()
  })
})
