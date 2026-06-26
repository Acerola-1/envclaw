import Router from '@koa/router'
import * as ctrl from '../../controllers/envclaw/platforms'

export const platformRoutes = new Router()

platformRoutes.get('/api/envclaw/platforms', ctrl.list)
platformRoutes.get('/api/envclaw/platforms/:id', ctrl.get)
platformRoutes.post('/api/envclaw/platforms', ctrl.create)
platformRoutes.patch('/api/envclaw/platforms/:id', ctrl.update)
platformRoutes.delete('/api/envclaw/platforms/:id', ctrl.remove)
platformRoutes.post('/api/envclaw/platforms/:id/accounts', ctrl.addAccount)
platformRoutes.patch('/api/envclaw/platforms/:id/accounts/:accountId', ctrl.updateAccount)
platformRoutes.delete('/api/envclaw/platforms/:id/accounts/:accountId', ctrl.deleteAccount)
