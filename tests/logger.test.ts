/*
 * @Path          : \kook-bot-cgrelay\tests\logger.test.ts
 * @Created At    : 2024-05-21 16:52:06
 * @Last Modified : 2024-05-21 16:54:22
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { log } from "../src/utils/logging/logger"

test('loggers work', () => {
    log('info', 'aaa', 1, 2, 3, [1, 2, 3])
})
