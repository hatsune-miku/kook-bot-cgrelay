/*
 * @Path          : \kook-bot-cgrelay\src\chat\openai.ts
 * @Created At    : 2024-05-22 17:45:24
 * @Last Modified : 2024-05-29 23:00:54
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import OpenAI from "openai"
import { Env } from "../utils/env/env"
import { die } from "../utils/server/die"
import { draw } from "radash"
import { ChatCompletionMessageParam } from "openai/resources"
import { ContextUnit } from "./types"
die('环境配置错误：OPENAI_API_KEYS')
}

export async function chatCompletionWithoutStream(context: ContextUnit[]): Promise<string> {
    const openai = new OpenAI({
        apiKey: draw(Env.OpenAIKeys)!
    })

    let messages: Array<ChatCompletionMessageParam> = [
        { role: 'system', content: '你是ChatGPT，作为某即时通讯平台的Bot，为用户提供简短的解答。你将看到[name: content]的发言形式，方便你区分不同用户。' },
        ...context.map(unit => ({
            ...unit,
            content: `${unit.name}: ${unit.content}`,

            // 奇怪的名字会让chatgpt的库崩溃
            name: undefined,
        })),
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
