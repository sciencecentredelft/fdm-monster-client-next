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
afterEach(() => { wrapper.unmount(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('floor grid convenience lock', () => {
  describe('inactivity auto-lock', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    })

    it('locks at exactly one minute, clears the grant, and restarts the timeout after another unlock', async () => {
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await submit()
      await vi.advanceTimersByTimeAsync(59999)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
      await vi.advanceTimersByTimeAsync(1)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
      expect(wrapper.emitted('update:locked')?.at(-1)).toEqual([true])
      expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
      await submit()
      await vi.advanceTimersByTimeAsync(59999)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
      await vi.advanceTimersByTimeAsync(1)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    })

    it.each(['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'])(
      'extends the timeout for %s activity', async event => {
        useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
        await submit()
        await vi.advanceTimersByTimeAsync(45000)
        document.dispatchEvent(new Event(event))
        await vi.advanceTimersByTimeAsync(59999)
        expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
        await vi.advanceTimersByTimeAsync(1)
        expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
      }
    )

    it('does not count live printer updates as user activity', async () => {
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await submit()
      await vi.advanceTimersByTimeAsync(45000)
      useFloorStore().floors = [{ ...floor }]
      await flushPromises()
      await vi.advanceTimersByTimeAsync(15000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    })

    it.each(['focus', 'pageshow', 'visibilitychange', 'pointerdown'])(
      'checks elapsed wall time on %s after browser suspension instead of extending an expired grant', async event => {
        useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
        await submit()
        vi.setSystemTime(Date.now() + 60000)
        const target = event === 'visibilitychange' || event === 'pointerdown' ? document : window
        target.dispatchEvent(new Event(event))
        await flushPromises()
        expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
      }
    )

    it('does not count events in a hidden tab as activity', async () => {
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await submit()
      await vi.advanceTimersByTimeAsync(45000)
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
      document.dispatchEvent(new Event('pointermove'))
      await vi.advanceTimersByTimeAsync(15000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    })

    it('keeps auto-lock disabled by default and reschedules when the configured timeout changes', async () => {
      await submit()
      await vi.advanceTimersByTimeAsync(600000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
      document.dispatchEvent(new Event('keydown'))
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 2 } } })
      await vi.advanceTimersByTimeAsync(60000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await flushPromises()
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    })

    it('cancels the timer when disabled and never auto-locks administrators or unprotected floors', async () => {
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await submit()
      await vi.advanceTimersByTimeAsync(30000)
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 0 } } })
      await vi.advanceTimersByTimeAsync(60000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
      useProfileStore().roles = ['ADMIN']
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await vi.advanceTimersByTimeAsync(60000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
      useProfileStore().roles = ['OPERATOR']
      useFloorStore().selectedFloorIndex = 1
      await vi.advanceTimersByTimeAsync(60000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
    })

    it('does not extend the timeout when the tab regains focus before the deadline', async () => {
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await submit()
      await vi.advanceTimersByTimeAsync(30000)
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(30000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(false)
    })

    it('cancels the timer immediately if the master grid-lock feature is disabled', async () => {
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await submit()
      useSettingsStore().$patch({ settings: { server: { floorGridLockEnabled: false } } })
      expect(vi.getTimerCount()).toBe(0)
      await vi.advanceTimersByTimeAsync(60000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
    })

    it('does not overflow browser timers for very large minute values', async () => {
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 40000 } } })
      await submit()
      await vi.advanceTimersByTimeAsync(60000)
      expect(wrapper.find('[data-test="grid"]').exists()).toBe(true)
    })

    it('removes its activity listeners and timer on unmount', async () => {
      useSettingsStore().$patch({ settings: { server: { floorGridIdleTimeoutMinutes: 1 } } })
      await submit()
      const remove = vi.spyOn(document, 'removeEventListener')
      const removeWindow = vi.spyOn(window, 'removeEventListener')
      wrapper.unmount()
      expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function), true)
      expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(removeWindow).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(removeWindow).toHaveBeenCalledWith('pageshow', expect.any(Function))
      expect(vi.getTimerCount()).toBe(0)
    })
  })

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
