import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import UserDirectorySettings from '@/components/Settings/UserDirectorySettings.vue'
import { SettingsService } from '@/backend/settings.service'
import { defaultUserDirectoryConfig } from '@/models/settings/user-directory.dto'

vi.mock('@/backend/settings.service', () => ({
  SettingsService: {
    getUserDirectorySettings: vi.fn(),
    updateUserDirectorySettings: vi.fn(),
    testUserDirectoryConnection: vi.fn(),
    refreshUserDirectoryUsers: vi.fn()
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(SettingsService.getUserDirectorySettings).mockResolvedValue({
    config: { ...defaultUserDirectoryConfig },
    hasClientSecret: false
  })
  vi.mocked(SettingsService.updateUserDirectorySettings).mockImplementation(async (config, secret) => ({
    config,
    hasClientSecret: !!secret
  }))
})

describe('UserDirectorySettings', () => {
  it('places API actions above its configuration and saves the manual-entry option', async () => {
    vi.mocked(SettingsService.getUserDirectorySettings).mockResolvedValue({
      config: { ...defaultUserDirectoryConfig, enabled: true, endpoint: 'https://people.example/api/users' },
      hasClientSecret: false
    })
    const wrapper = mount(UserDirectorySettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const save = wrapper.findAll('button').find(button => button.text() === 'Save directory settings')!
    const url = wrapper.get('input[type="url"]')
    expect(save.element.compareDocumentPosition(url.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const checkbox = wrapper.findAllComponents({ name: 'VCheckbox' })
      .find(component => component.props('label') === 'Allow manual assignee names')!
    expect(checkbox.props('modelValue')).toBe(true)
    checkbox.vm.$emit('update:modelValue', false)
    await flushPromises()
    await save.trigger('click')
    await flushPromises()
    expect(SettingsService.updateUserDirectorySettings).toHaveBeenCalledWith(
      expect.objectContaining({ allowManualEntry: false }), undefined, false
    )
    wrapper.unmount()
  })

  it('refreshes cached users and disables refresh until changed settings are saved', async () => {
    vi.mocked(SettingsService.getUserDirectorySettings).mockResolvedValue({
      config: { ...defaultUserDirectoryConfig, enabled: true, endpoint: 'https://people.example/api/users' },
      hasClientSecret: false
    })
    vi.mocked(SettingsService.refreshUserDirectoryUsers).mockResolvedValue({ success: true, userCount: 1829 })
    const wrapper = mount(UserDirectorySettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const refresh = () => wrapper.findAll('button').find(button => button.text() === 'Refresh cached users')!
    await refresh().trigger('click')
    await flushPromises()
    expect(SettingsService.refreshUserDirectoryUsers).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('User cache refreshed. Loaded 1829 people.')
    await wrapper.get('input[type="url"]').setValue('https://people.example/updated')
    expect(refresh().attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('shows refresh failures explicitly and allows retrying', async () => {
    vi.mocked(SettingsService.getUserDirectorySettings).mockResolvedValue({
      config: { ...defaultUserDirectoryConfig, enabled: true, endpoint: 'https://people.example/api/users' },
      hasClientSecret: false
    })
    vi.mocked(SettingsService.refreshUserDirectoryUsers).mockRejectedValue(new Error('Unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(UserDirectorySettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const refresh = wrapper.findAll('button').find(button => button.text() === 'Refresh cached users')!
    await refresh.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Could not refresh the user cache.')
    expect(refresh.attributes('disabled')).toBeUndefined()
    expect(log).toHaveBeenCalled()
    wrapper.unmount()
    log.mockRestore()
  })

  it('saves optional numbered pagination and combined-name mappings', async () => {
    vi.mocked(SettingsService.getUserDirectorySettings).mockResolvedValue({
      config: { ...defaultUserDirectoryConfig, enabled: true, endpoint: 'https://people.example/api/users' },
      hasClientSecret: false
    })
    const wrapper = mount(UserDirectorySettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const checkbox = (label: string) => wrapper.findAllComponents({ name: 'VCheckbox' })
      .find(component => component.props('label') === label)!
    const field = (label: string) => wrapper.findAllComponents({ name: 'VTextField' })
      .find(component => component.props('label') === label)!
    expect(wrapper.text()).not.toContain('Page number query parameter')
    expect(wrapper.text()).not.toContain('First name JSON path')
    checkbox('Fetch all numbered pages').vm.$emit('update:modelValue', true)
    checkbox('Combine first and last names').vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(field('Page number query parameter').props('modelValue')).toBe('page_number')
    expect(field('Page size query parameter').props('modelValue')).toBe('page_size')
    expect(field('Users per page').props('modelValue')).toBe(50)
    expect(field('Total count JSON path').props('modelValue')).toBe('count')
    expect(field('First name JSON path').props('modelValue')).toBe('first_name')
    expect(field('Last name JSON path').props('modelValue')).toBe('last_name')
    expect(wrapper.text()).not.toContain('Person name JSON path')
    field('Users array JSON path').vm.$emit('update:modelValue', 'results')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Save directory settings')!.trigger('click')
    await flushPromises()
    expect(SettingsService.updateUserDirectorySettings).toHaveBeenCalledWith(
      { ...defaultUserDirectoryConfig, enabled: true, endpoint: 'https://people.example/api/users',
        usersPath: 'results', paginationEnabled: true, combineNames: true },
      undefined, false
    )
    wrapper.unmount()
  })

  it('prevents saving invalid pagination settings', async () => {
    vi.mocked(SettingsService.getUserDirectorySettings).mockResolvedValue({
      config: { ...defaultUserDirectoryConfig, enabled: true, endpoint: 'https://people.example/api/users',
        paginationEnabled: true, combineNames: true },
      hasClientSecret: false
    })
    const wrapper = mount(UserDirectorySettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const save = () => wrapper.findAll('button').find(button => button.text() === 'Save directory settings')!
    const field = (label: string) => wrapper.findAllComponents({ name: 'VTextField' })
      .find(component => component.props('label') === label)!
    expect(save().attributes('disabled')).toBeUndefined()
    for (const invalid of [0, 1001, 1.5, '']) {
      field('Users per page').vm.$emit('update:modelValue', invalid)
      await flushPromises()
      expect(save().attributes('disabled')).toBeDefined()
    }
    field('Users per page').vm.$emit('update:modelValue', 50)
    field('Page number query parameter').vm.$emit('update:modelValue', 'page_size')
    await flushPromises()
    expect(save().attributes('disabled')).toBeDefined()
    field('Page number query parameter').vm.$emit('update:modelValue', 'page_number')
    field('First name JSON path').vm.$emit('update:modelValue', '')
    await flushPromises()
    expect(save().attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('is disabled by default and persists the server-side directory configuration', async () => {
    const wrapper = mount(UserDirectorySettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Enable user directory API')
    expect(wrapper.find('input[type="url"]').exists()).toBe(false)

    wrapper.findComponent({ name: 'VCheckbox' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    await wrapper.get('input[type="url"]').setValue('https://people.example/api/users')
    await wrapper.findAll('button').find(button => button.text() === 'Save directory settings')!.trigger('click')
    await flushPromises()

    expect(SettingsService.updateUserDirectorySettings).toHaveBeenCalledWith(
      { ...defaultUserDirectoryConfig, enabled: true, endpoint: 'https://people.example/api/users' },
      undefined,
      false
    )
    expect(wrapper.text()).toContain('User directory settings saved.')
    wrapper.unmount()
  })

  it('reports the live connection-test result', async () => {
    vi.mocked(SettingsService.getUserDirectorySettings).mockResolvedValue({
      config: { ...defaultUserDirectoryConfig, enabled: true, endpoint: 'https://people.example/api/users' },
      hasClientSecret: false
    })
    vi.mocked(SettingsService.testUserDirectoryConnection).mockResolvedValue({ success: true, userCount: 3 })
    const wrapper = mount(UserDirectorySettings, {
      global: { plugins: [createPinia(), createVuetify()] }
    })
    await flushPromises()
    const testButton = wrapper.findAll('button').find(button => button.text() === 'Test connection')
    expect(testButton).toBeDefined()
    await testButton!.trigger('click')
    await flushPromises()
    expect(SettingsService.testUserDirectoryConnection).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Connection successful. Found 3 people.')
    wrapper.unmount()
  })
})
