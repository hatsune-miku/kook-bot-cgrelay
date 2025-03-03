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
      role: unit.role === "user" ? "user" : "assistant",
      name: `${unit.name}(id=${unit.id})`,
      content: unit.content
    }))
    return [
      {
        role: "system",
        content: `请你作为KOOK平台的群聊成员Miku参与讨论，回答用户问题，以最后一条消息为最高优先级。注意：
        - 直接开始回答，不需带有"Miku说:"前缀
        - 若需要输出 Markdown，则下列额外规则适用：
            - 请勿使用 #, ##, ###
            - 必须使用半角括号
            - 支持 (spl)文字点击后显示(spl) 语法来显示带有剧透的内容
            - 支持 (met)对方整数id(met) 语法来提及（@）对方，例如 (met)123456(met)`
      },
      ...(units as ChatCompletionMessageParam[])
    ]
  }
  return [
    {
      role: "system",
      content:
        "你是DeepSeek LLM，作为某即时通讯平台的Bot，为用户提供简短的解答。"
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
    baseURL: "https://api.deepseek.com",
    apiKey: draw(Env.DeepSeekKeys)!
  })

  let messages = makeContext(groupChat, context)

  try {
    const completion = await openai.chat.completions.create({
      messages: messages,
      model: model
    })

    const message = completion.choices[0].message
    const reasoningContent =
      "reasoning_content" in message ? message.reasoning_content : null

    if (message.content) {
      if (reasoningContent) {
        return `${reasoningContent}\n\n${message.content}`
      }
      return message.content
    } else {
      return "<no content>"
    }
  } catch (e) {
    console.error(e)
    return "<与 DeepSeek 的连接超时>"
  }
}
