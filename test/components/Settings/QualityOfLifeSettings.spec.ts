import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import QualityOfLifeSettings from '@/components/Settings/QualityOfLifeSettings.vue'
import { SettingsService } from '@/backend'
import { useSettingsStore } from '@/store/settings.store'
import type { SettingsDto } from '@/models/settings/settings.model'
import type { AdvancedFileListColumns } from '@/models/settings/server-settings.dto'

vi.mock('@/backend', () => ({
  SettingsService: {
    getSettings: vi.fn(),
    updateAdvancedFileList: vi.fn()
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
  it('defaults to disabled with the description and column controls hidden', async () => {
    const wrapper = mount(QualityOfLifeSettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const checkbox = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox.element.checked).toBe(false)
    expect(wrapper.text()).not.toContain('Enable Experimental')
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').map(input => input.element.checked))
      .toEqual([false])
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
      .toEqual([true, true, true])
    expect(wrapper.text()).toContain('Show sortable columns and one search field across visible columns.')
    await checkbox.setValue(false)
    await flushPromises()
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(false, { size: true, startedAt: true })
    expect(useSettingsStore(pinia).serverSettings?.advancedFileListEnabled).toBe(false)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(1)
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
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(1)
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
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(1)
    await enable.setValue(true)
    await flushPromises()
    const inputs = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(inputs.map(input => input.element.checked)).toEqual([true, false, true])
    await inputs[2].setValue(false)
    await flushPromises()
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(true, { size: false, startedAt: false })
    expect(useSettingsStore(pinia).serverSettings?.advancedFileListColumns).toEqual({ size: false, startedAt: false })
    await enable.setValue(false)
    await flushPromises()
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(1)
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(false, { size: false, startedAt: false })
    await enable.setValue(true)
    await flushPromises()
    expect(SettingsService.updateAdvancedFileList).toHaveBeenLastCalledWith(true, { size: false, startedAt: false })
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').map(input => input.element.checked))
      .toEqual([true, false, false])
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
})
