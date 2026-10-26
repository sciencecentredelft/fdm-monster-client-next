import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import FloorGridLock from '@/components/PrinterGrid/FloorGridLock.vue'
import { FloorService } from '@/backend/floor.service'
import { useFloorStore } from '@/store/floor.store'
import { useSettingsStore } from '@/store/settings.store'
import { useProfileStore } from '@/store/profile.store'

vi.mock('@/backend/floor.service', () => ({
  FloorService: { unlockGrid: vi.fn(), getFloors: vi.fn() }
}))

const floor = { id: 1, name: 'Protected floor', order: 1, printers: [], gridProtected: true, gridLockVersion: 'version-1' }
let wrapper: ReturnType<typeof mount>
function render() {
  wrapper = mount(FloorGridLock, {
    slots: { default: '<div data-test="grid">Grid and print actions</div>' },
    global: { plugins: [createVuetify()] }
  })
}
async function submit(password = 'group-password') {
  await wrapper.get('input').setValue(password)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  useSettingsStore().$patch({ settings: { server: { floorGridLockEnabled: true } } })
  useFloorStore().floors = [{ ...floor }, { ...floor, id: 2, name: 'Other floor', gridProtected: false }]
  vi.mocked(FloorService.unlockGrid).mockResolvedValue({ unlocked: true, gridLockVersion: 'version-1' })
  render()
})
afterEach(() => { wrapper.unmount(); vi.restoreAllMocks() })

describe('floor grid convenience lock', () => {
  it('hides the grid until a correct password and provides a manual lock', async () => {
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Protected floor')
    vi.mocked(FloorService.unlockGrid).mockResolvedValueOnce({ unlocked: false, gridLockVersion: 'version-1' })
    await submit('wrong')
    expect(wrapper.text()).toContain('Incorrect group password')
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    await submit()
    expect(FloorService.unlockGrid).toHaveBeenLastCalledWith(1, 'group-password')
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
  })

  it('does not relock on regular live updates but does on switching away and back', async () => {
    await submit()
    useFloorStore().floors = [{ ...floor }, { ...floor, id: 2, gridProtected: false }]
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
    useFloorStore().selectedFloorIndex = 1
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
    useFloorStore().selectedFloorIndex = 0
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    await submit()
    useFloorStore().floors[0].gridLockVersion = 'version-2'
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
  })

  it('requires unlocking again after leaving and remounting the grid', async () => {
    await submit()
    wrapper.unmount()
    render()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
  })

  it('bypasses only for administrators or when the feature is disabled', async () => {
    useProfileStore().roles = ['ADMIN']
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
    expect(FloorService.unlockGrid).not.toHaveBeenCalled()
    useProfileStore().roles = ['OPERATOR']
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    useSettingsStore().$patch({ settings: { server: { floorGridLockEnabled: false } } })
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
    useSettingsStore().$patch({ settings: { server: { floorGridLockEnabled: true } } })
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
  })

  it('ignores late verification results after changing floors', async () => {
    let resolve!: (value: { unlocked: boolean; gridLockVersion: string }) => void
    vi.mocked(FloorService.unlockGrid).mockReturnValueOnce(new Promise(done => { resolve = done }))
    await submit()
    useFloorStore().selectedFloorIndex = 1
    await flushPromises()
    useFloorStore().selectedFloorIndex = 0
    await flushPromises()
    resolve({ unlocked: true, gridLockVersion: 'version-1' })
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
  })

  it('reports request failures without opening the grid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(FloorService.unlockGrid).mockRejectedValueOnce(new Error('Unavailable'))
    await submit()
    expect(wrapper.text()).toContain('Could not unlock the grid')
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
  })

  it('does not accept a response verified against a different password version', async () => {
    vi.mocked(FloorService.unlockGrid).mockResolvedValueOnce({ unlocked: true, gridLockVersion: 'version-2' })
    vi.mocked(FloorService.getFloors).mockResolvedValue([{ ...floor, gridLockVersion: 'version-2' }])
    await submit()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    expect(FloorService.getFloors).toHaveBeenCalled()
  })

  it('clears an unlocked view if the signed-in user changes', async () => {
    await submit()
    useProfileStore().userId = 5
    await flushPromises()
    expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
  })
})
