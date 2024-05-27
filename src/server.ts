/*
 * @Path          : \kook-bot-cgrelay\src\server.ts
 * @Created At    : 2024-05-21 16:20:02
 * @Last Modified : 2024-05-27 12:48:35
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { info } from "console"
import express from 'express'
import { main } from "./bot"

info('Server Startup')

const expressApp = express()
const port = 6308

expressApp.listen(port, async () => {
    await main()
    info(`Server listening at http://localhost:${port}`)
})
