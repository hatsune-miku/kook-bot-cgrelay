/*
 * @Path          : \kook-bot-cgrelay\src\initialize.ts
 * @Created At    : 2024-05-21 17:13:02
 * @Last Modified : 2024-05-22 16:10:40
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { info } from "./utils/logging/logger"
import { webSocketInitialize } from "./websocket/initialize"

export async function initialize() {
    await webSocketInitialize()
    info("Initialization OK")
}
