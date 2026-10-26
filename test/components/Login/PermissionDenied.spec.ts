import { describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { LocationQuery } from 'vue-router'
import PermissionDenied from '@/components/Login/PermissionDenied.vue'

const route = reactive<{ query: LocationQuery }>({ query: {} })
vi.mock('vue-router', () => ({ useRoute: () => route }))

describe('permission denied details', () => {
  it.each(['ADMIN', ['ADMIN'], ['ADMIN', 'OPERATOR']])('renders roles from query value %j', (roles) => {
    route.query = { roles, permissions: 'Floors.Delete', page: '/settings/floors', error: 'Administrator access required' }
    const wrapper = shallowMount(PermissionDenied, { global: { renderStubDefaultSlot: true } })
    expect(wrapper.text()).toContain(Array.isArray(roles) ? roles.join(', ') : roles)
    expect(wrapper.text()).toContain('Floors.Delete')
    expect(wrapper.text()).toContain('Administrator access required')
    wrapper.unmount()
  })
})
