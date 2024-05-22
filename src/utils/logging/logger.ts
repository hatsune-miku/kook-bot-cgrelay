/*
 * @Path          : \kook-bot-cgrelay\src\utils\logging\logger.ts
 * @Created At    : 2024-05-21 16:47:55
 * @Last Modified : 2024-05-22 15:07:32
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { DateTime } from "luxon"

function log(level: string, ...data: any[]) {
    const nowFormatted = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')
    console.log(`[${nowFormatted}] [KBot] [${level}]`, data)
}

export function error(...data: any[]) {
    log('ERROR', data)
}

export function warn(...data: any[]) {
    log('WARN', data)
}

export function info(...data: any[]) {
    log('INFO', data)
}
