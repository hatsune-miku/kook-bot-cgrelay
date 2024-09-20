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

function makeContext(
  groupChat: boolean,
  context: ContextUnit[]
): ChatCompletionMessageParam[] {
  if (groupChat) {
    const units = context.map((unit) => ({
      role: unit.role === "user" ? "system" : "assistant",
      content:
        unit.role === "user" ? `${unit.name}说: ${unit.content}` : unit.content
    }))
    return [
      {
        role: "system",
        content:
          "你是ChatGPT。请你作为通讯平台KOOK的群聊的一员，参与大家的讨论。请总是给对话的最后一条以适当关注，那可能是用户对你的提问哦。语气不宜浮夸，宜诙谐可爱中不失从容优雅。"
      },
      ...(units as ChatCompletionMessageParam[])
    ]
  }
  return [
    {
      role: "system",
      content: "你是ChatGPT，作为某即时通讯平台的Bot，为用户提供简短的解答。"
    },
    ...context
  ]
}

export async function chatCompletionWithoutStream(
  groupChat: boolean,
  context: ContextUnit[],
  model: string
): Promise<string> {
  const openai = new OpenAI({
    apiKey: draw(Env.OpenAIKeys)!
  })

  let messages = makeContext(groupChat, context)

  try {
    const completion = await openai.chat.completions.create({
      messages: messages,
      model: model
    })

    return completion.choices[0].message.content ?? "<no content>"
  } catch (e) {
    console.error(e)
    return "<与 OpenAI 的连接超时>"
  }
}
