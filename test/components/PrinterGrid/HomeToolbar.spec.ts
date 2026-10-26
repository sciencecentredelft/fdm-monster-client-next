import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeToolbar from '@/components/PrinterGrid/HomeToolbar.vue'
import { useProfileStore } from '@/store/profile.store'
import { usePrinterStore } from '@/store/printer.store'
import { useFloorStore } from '@/store/floor.store'
import type { PrinterDto } from '@/models/printers/printer.model'

vi.mock('@/backend/printer-tag.service', () => ({
  PrinterTagService: { getTagsWithPrinters: vi.fn().mockResolvedValue([]) }
}))

beforeEach(() => {
  setActivePinia(createPinia())
  const printer: PrinterDto = {
    id: 1, name: 'Alpha', printerType: 0, enabled: true, dateAdded: 0,
    disabledReason: '', webSocketURL: '', apiKey: '', username: '', password: '',
    printerURL: 'http://127.0.0.1'
  }
  usePrinterStore().printers = [printer]
  useFloorStore().floors = [{ id: 1, name: 'Main', order: 1, printers: [] }]
})

describe('grid configuration permissions', () => {
  it('keeps floor selection and filters but hides shared configuration for operators', async () => {
    const wrapper = shallowMount(HomeToolbar, { global: { renderStubDefaultSlot: true } })
    expect(wrapper.text()).toContain('Main')
    expect(wrapper.find('printer-tag-filter-stub').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Auto Place')
    expect(wrapper.find('grid-size-control-stub').exists()).toBe(false)
    expect(wrapper.find('grid-settings-menu-stub').exists()).toBe(false)
    useProfileStore().roles = ['ADMIN']
    await flushPromises()
    expect(wrapper.text()).toContain('Auto Place')
    expect(wrapper.find('grid-size-control-stub').exists()).toBe(true)
    expect(wrapper.find('grid-settings-menu-stub').exists()).toBe(true)
    useProfileStore().roles = ['OPERATOR']
    await flushPromises()
    expect(wrapper.text()).not.toContain('Auto Place')
    wrapper.unmount()
  })
})
