/*
 * @Path          : \kook-bot-cgrelay\src\utils\server\die.ts
 * @Created At    : 2024-05-21 17:15:04
 * @Last Modified : 2024-05-21 18:21:26
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { KResponseExt } from "../krequest/types"
import { error } from "../logging/logger"

export function die(reason: string) {
    error(reason)
    error('Exiting...')
    process.exit(1)
}

export function successOrDie(res: KResponseExt<any>, reason?: string) {
    reason ||= '请求失败'
    if (!res.success) {
        die(reason)
    }
}
