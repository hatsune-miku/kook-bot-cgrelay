/*
 * @Path          : \kook-bot-cgrelay\src\chat\openai.ts
 * @Created At    : 2024-05-22 17:45:24
 * @Last Modified : 2024-05-29 23:00:54
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import OpenAI from "openai"
import { Env } from "../utils/env/env"
import { draw } from "radash"
import { ChatCompletionMessageParam } from "openai/resources"
import { ContextUnit } from "./types"

function makeContext(groupChat: boolean, context: ContextUnit[]): ChatCompletionMessageParam[] {
    if (groupChat) {
        return [
            { role: 'system', content: '你是ChatGPT，作为某即时通讯平台的Bot，为用户提供简短的解答。你将看到[name: content]的发言形式，方便你区分不同用户。' },
            ...context.map(unit => ({
                ...unit,
                content: unit.role === 'user'
                    ? `${unit.name}: ${unit.content}`
                    : unit.content,
                name: undefined,
                timestamp: undefined,
            })),
        ]
    }
    return [
        { role: 'system', content: '你是ChatGPT，作为某即时通讯平台的Bot，为用户提供简短的解答。' },
        ...context
    ]
}

export async function chatCompletionWithoutStream(groupChat: boolean, context: ContextUnit[]): Promise<string> {
    const openai = new OpenAI({
        apiKey: draw(Env.OpenAIKeys)!
    })

    let messages = makeContext(groupChat, context)
    if (messages.length > 12) {
        messages = messages.slice(messages.length - 10)
    }

    const completion = await openai.chat.completions.create({
        messages: messages,
        model: 'gpt-4o',
    })

    return completion.choices[0].message.content ?? "<no content>"
}
