/*
 * @Path          : \kook-bot-cgrelay\src\chat\openai.ts
 * @Created At    : 2024-05-22 17:45:24
 * @Last Modified : 2024-05-24 19:20:46
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import OpenAI from "openai"
import { Env } from "../utils/env/env"
import { die } from "../utils/server/die"
import { draw } from "radash"
import { ChatCompletionMessageParam } from "openai/resources"
import { ContextUnit } from "./types"

if (Env.OPENAI_API_KEYS.length === 0) {
    die('环境配置错误：OPENAI_API_KEYS')
}

export async function chatCompletionWithoutStream(
    nickname: string,
    context: ContextUnit[],
    prompt: string
): Promise<string> {
    return `openai echo nickname=${nickname} prompt=${prompt}`

    const openai = new OpenAI({
        apiKey: draw(Env.OPENAI_API_KEYS)!
    })

    let messages: Array<ChatCompletionMessageParam> = [
        { role: 'system', content: '你是ChatGPT，目前作为某即时通讯平台的一个Bot，为任何向你提问的用户提供简短的解答。' },
        { role: 'system', content: `与你对话的用户网名是:${nickname}` },
        ...context,
        { role: 'user', content: prompt }
    ]

    if (messages.length > 12) {
        messages = messages.slice(messages.length - 10)
    }

    const completion = await openai.chat.completions.create({
        messages: messages,
        model: 'gpt-3.5-turbo',
    })

    return completion.choices[0].message.content ?? "<no content>"
}
