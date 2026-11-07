import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MiddleTruncatedName from '@/components/Files/MiddleTruncatedName.vue'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('MiddleTruncatedName', () => {
  it('fits actual measured space, responds to resize/name changes, and cleans up its observer', async () => {
    let width = 140
    let resized = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resized = callback }
      observe() {}
      disconnect = disconnect
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, 0, this.classList.contains('name-measurement')
        ? Array.from(this.textContent ?? '').length * 10 : width, 20)
    })
    const name = 'prefix-very-long-middle-part.gcode'
    const wrapper = mount(MiddleTruncatedName, { props: { text: name } })
    await flushPromises()
    expect(wrapper.text()).toBe('prefix\u2026t.gcode')
    expect(wrapper.attributes('aria-label')).toBe(name)
    expect(wrapper.get('.name-measurement').text()).toBe('')
    width = 500
    resized()
    await flushPromises()
    expect(wrapper.text()).toBe(name)
    await wrapper.setProps({ text: 'short.gcode' })
    expect(wrapper.text()).toBe('short.gcode')
    width = 80
    resized()
    await flushPromises()
    expect(wrapper.text()).toBe('sho\u2026code')
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
