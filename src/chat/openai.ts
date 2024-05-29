/*
 * @Path          : \kook-bot-cgrelay\src\chat\openai.ts
 * @Created At    : 2024-05-22 17:45:24
 * @Last Modified : 2024-05-29 19:09:09
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import OpenAI from "openai"
import { Env } from "../utils/env/env"
import { die } from "../utils/server/die"
import { draw } from "radash"
import { ChatCompletionMessageParam } from "openai/resources"
import { ContextUnit } from "./types"

if (Env.OpenAIKeys.length === 0) {
    die('环境配置错误：OPENAI_API_KEYS')
}

export async function chatCompletionWithoutStream(context: ContextUnit[]): Promise<string> {
    const openai = new OpenAI({
        apiKey: draw(Env.OpenAIKeys)!
    })

    let messages: Array<ChatCompletionMessageParam> = [
        { role: 'system', content: '你是ChatGPT，目前作为某即时通讯平台的一个Bot，为任何向你提问的用户提供简短的解答。' },
        ...context,
    ]

    if (messages.length > 12) {
        messages = messages.slice(messages.length - 10)
    }

    const completion = await openai.chat.completions.create({
        messages: messages,
        model: 'gpt-4o',
    })

    return completion.choices[0].message.content ?? "<no content>"
}
