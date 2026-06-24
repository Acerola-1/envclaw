import Router from '@koa/router'
import { getChannelContacts } from '../../controllers/hermes/channel-contacts'

export const channelContactRoutes = new Router()

channelContactRoutes.get('/api/hermes/channel-contacts', getChannelContacts)
