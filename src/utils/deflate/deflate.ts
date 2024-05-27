/*
 * @Path          : \kook-bot-cgrelay\src\utils\deflate\deflate.ts
 * @Created At    : 2024-05-21 17:30:13
 * @Last Modified : 2024-05-21 17:38:18
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import Pako from "pako"
import { KMessage } from "../../websocket/kwebsocket/types"

/**
 * @throws
 */
export function decompressKMessage<T>(data: Pako.Data): KMessage<T> {
    const decompressed = Pako.inflate(data, { to: 'string' })
    return JSON.parse(decompressed) as KMessage<T>
}
