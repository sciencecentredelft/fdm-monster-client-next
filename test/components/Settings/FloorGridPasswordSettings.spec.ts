import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import FloorGridPasswordSettings from '@/components/Settings/FloorGridPasswordSettings.vue'
import { useFloorStore } from '@/store/floor.store'
import { FloorService } from '@/backend/floor.service'

vi.mock('@/backend/floor.service', () => ({ FloorService: { setGridPassword: vi.fn() } }))
const floor = { id: 1, name: 'Group', order: 1, printers: [], gridProtected: false }
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  useFloorStore().floors = [{ ...floor }]
})

describe('floor grid password settings', () => {
  it('validates, saves and clears the password without retaining plaintext', async () => {
    const saved = { ...floor, gridProtected: true, gridLockVersion: 'version-1' }
    vi.mocked(FloorService.setGridPassword).mockResolvedValue(saved)
    const wrapper = mount(FloorGridPasswordSettings, { props: { floor }, global: { plugins: [createVuetify()] } })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('input').setValue('short')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('input').setValue('é'.repeat(37))
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('input').setValue('group-password')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(FloorService.setGridPassword).toHaveBeenCalledWith(1, 'group-password')
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
    expect(useFloorStore().floors[0].gridProtected).toBe(true)
    await wrapper.setProps({ floor: saved })
    vi.mocked(FloorService.setGridPassword).mockResolvedValue(floor)
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()
    expect(FloorService.setGridPassword).toHaveBeenLastCalledWith(1, null)
    expect(wrapper.text()).toContain('password removed')
    wrapper.unmount()
  })
})
