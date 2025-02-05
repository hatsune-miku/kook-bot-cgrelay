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
        content: `请你作为KOOK平台的群聊成员Miku参与讨论。注意：
          - 对话的最后一条是用户对你的提问
          - 语气不宜浮夸，宜接近作为AI的严谨风格，但不必太严谨
          - 优先使用全角波浪号代替感叹号，不超过2次
          - 若需要输出 Markdown，则下列额外规则适用：
              - 请勿使用 #, ##, ###
              - 必须使用半角括号
              - 支持 (spl)文字点击后显示(spl) 语法来显示带有剧透的内容
              - 支持 (met)对方整数id(met) 语法来提及（艾特）对方，例如 (met)123456(met)
        `
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

    return completion.choices[0].message.content ?? "<no content>"
  } catch (e) {
    console.error(e)
    return "<与 DeepSeek 的连接超时>"
  }
}
