// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import router from '@/router'

// Regression for upstream #1797 "fix mcp admin route access", adapted to the
// fork: the fork's sidebar MCP/devices links live in a commented-out nav group,
// so the meaningful protection is the router meta guard. Device management must
// require super admin (direct-URL navigation is redirected for non-super-admins)
// while the MCP manager must stay reachable for regular admins.
describe('router super-admin guards', () => {
  it('gates device management behind super admin but leaves MCP open to admins', () => {
    const routes = router.getRoutes()
    const devices = routes.find(route => route.name === 'hermes.devices')
    const mcp = routes.find(route => route.name === 'hermes.mcp')

    expect(devices, 'hermes.devices route should be registered').toBeTruthy()
    expect(mcp, 'hermes.mcp route should be registered').toBeTruthy()

    expect(devices?.meta.requiresSuperAdmin).toBe(true)
    expect(mcp?.meta.requiresSuperAdmin).toBeUndefined()
  })
})
