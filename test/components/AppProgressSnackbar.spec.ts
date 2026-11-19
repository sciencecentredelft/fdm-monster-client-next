import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { expect, it, vi } from 'vitest'
import AppProgressSnackbar from '@/components/Generic/Snackbars/AppProgressSnackbar.vue'
import { useSnackbar } from '@/shared/snackbar.composable'

vi.mock('vuetify/components/VSnackbar', () => ({ VSnackbar: { template: '<div><slot /></div>' } }))
vi.mock('vuetify/components/VIcon', () => ({ VIcon: { template: '<i />' } }))
vi.mock('vuetify/components/VGrid', () => ({ VSpacer: { template: '<div />' } }))
vi.mock('vuetify/components/VProgressLinear', () => ({ VProgressLinear: { template: '<div />' } }))
vi.mock('vuetify/components/VBtn', () => ({ VBtn: { template: '<button />' } }))

it('keeps waiting after all bytes are sent until the request settles', async () => {
  vi.useFakeTimers()
  const wrapper = mount(AppProgressSnackbar, {
    global: {
      stubs: { VSnackbar: { template: '<div><slot /></div>' }, VIcon: true, VSpacer: true, VProgressLinear: true, VBtn: true }
    }
  })

  try {
    const snackbar = useSnackbar()
    snackbar.openProgressMessage('upload-2', 'Test file', 0, false, 'pending')
    snackbar.openProgressMessage('upload-2', 'Test file', 100, false, 'pending')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wrapper.text()).toContain('Waiting for server')
    expect(wrapper.text()).not.toContain('Upload ended')

    snackbar.openProgressMessage('upload-2', 'Test file', 0, false, 'settled')
    await nextTick()
    expect(wrapper.text()).not.toContain('Test file')
  } finally {
    wrapper.unmount()
    vi.useRealTimers()
  }
})
