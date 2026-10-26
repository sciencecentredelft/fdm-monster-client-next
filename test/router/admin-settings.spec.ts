import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import { useProfileStore } from '@/store/profile.store'
import { useAuthStore } from '@/store/auth.store'
import { settingsPage } from '@/router/setting.constants'
import { RouteNames } from '@/router/route-names'

beforeEach(async () => {
  setActivePinia(createPinia())
  useAuthStore().loginRequired = false
  vi.spyOn(useProfileStore(), 'getProfile').mockResolvedValue(undefined)
  await router.push('/printer-grid')
})

describe('admin-only settings routes', () => {
  const adminPaths = Object.values(settingsPage).map(item => item.path)
    .filter(path => path !== '/settings/account' && path !== '/settings/about')

  it.each(adminPaths)('rejects a direct operator visit to %s', async (path) => {
    useProfileStore().roles = ['OPERATOR']
    await router.push(path)
    expect(router.currentRoute.value.name).toBe(RouteNames.PermissionDenied)
    expect(router.currentRoute.value.query.roles).toBe('ADMIN')
  })

  it.each(adminPaths)('allows an administrator to visit %s', async (path) => {
    useProfileStore().roles = ['ADMIN']
    await router.push(path)
    expect(router.currentRoute.value.path).toBe(path)
  })

  it('retains personal account access and sends operators there by default', async () => {
    useProfileStore().roles = ['OPERATOR']
    await router.push('/settings')
    expect(router.currentRoute.value.path).toBe('/settings/account')
    await router.push('/settings/about')
    expect(router.currentRoute.value.path).toBe('/settings/about')
  })
})
