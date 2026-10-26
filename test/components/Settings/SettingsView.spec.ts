import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import SettingsView from '@/components/Settings/SettingsView.vue'
import { useProfileStore } from '@/store/profile.store'

const route = reactive({ path: '/settings/floors' })
vi.mock('vue-router', () => ({ useRoute: () => route }))

beforeEach(() => {
  setActivePinia(createPinia())
  useProfileStore().$patch({ userId: 1, roles: ['OPERATOR'] })
  route.path = '/settings/floors'
})

describe('settings navigation', () => {
  it('hides server configuration links and content from operators, including after an account change', async () => {
    const wrapper = shallowMount(SettingsView, { global: { renderStubDefaultSlot: true } })
    const titles = () => wrapper.findAll('v-list-item-stub').map(item => item.attributes('title'))
    expect(titles()).toEqual(['Account', 'About'])
    expect(wrapper.find('router-view').exists()).toBe(false)
    expect(wrapper.text()).toContain('Administrator access is required')
    useProfileStore().roles = ['ADMIN']
    await flushPromises()
    expect(titles()).toContain('Floors')
    expect(titles()).toContain('Quality of Life')
    expect(wrapper.find('router-view').exists()).toBe(true)
    useProfileStore().roles = ['OPERATOR']
    route.path = '/settings/account'
    await flushPromises()
    expect(wrapper.find('router-view').exists()).toBe(true)
    wrapper.unmount()
  })
})
