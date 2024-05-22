/*
 * @Path          : \kook-bot-cgrelay\tests\request.test.ts
 * @Created At    : 2024-05-21 16:57:23
 * @Last Modified : 2024-05-21 17:07:06
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { Requests } from "../src/utils/krequest/request"

test('request works', async () => {
    const result = await Requests.request('/api/v3/non-exist', 'GET')
    console.log(result)
})
