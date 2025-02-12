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
import {
  DefaultChatCompletionTools,
  invokeToolFunction
} from "./functional/default-tools"
import { KEvent, KTextChannelExtra } from "../websocket/kwebsocket/types"
import { ChatDirectivesManager } from "./directives"

const CONSECUTIVE_FUNCTION_CALLS_THRESHOLD = 6

function makeContext(
  groupChat: boolean,
  context: ContextUnit[]
): ChatCompletionMessageParam[] {
  if (groupChat) {
    const units = context.map((unit) => ({
      role: unit.role === "user" ? "user" : "assistant",
      content: `${unit.name}(id=${unit.id})说: ${unit.content}`
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
      content: "你是ChatGPT，作为某即时通讯平台的Bot，为用户提供简短的解答。"
    },
    ...context
  ]
}

export async function chatCompletionWithoutStream(
  event: KEvent<KTextChannelExtra>,
  directivesManager: ChatDirectivesManager,
  groupChat: boolean,
  context: ContextUnit[],
  model: string
): Promise<string> {
  const openai = new OpenAI({
    apiKey: draw(Env.OpenAIKeys)!
  })

  let messages = makeContext(groupChat, context)

  try {
    let functionsFulfilled = false
    let functionCallDepthRemaining = CONSECUTIVE_FUNCTION_CALLS_THRESHOLD

    while (!functionsFulfilled) {
      const completion = await openai.chat.completions.create({
        messages: messages,
        model: model,
        tools: DefaultChatCompletionTools
      })

      const responseMessage = completion.choices?.[0].message
      if (!responseMessage) {
        return "<无法获取 OpenAI 的回复>"
      }

      messages.push(responseMessage)

      const toolCalls = responseMessage.tool_calls
      functionsFulfilled =
        !toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0

      if (functionsFulfilled) {
        return responseMessage.content || "<无法获取 OpenAI 的回复>"
      }

      if (--functionCallDepthRemaining <= 0) {
        return "<OpenAI 的回复过于复杂，无法处理>"
      }

      if (toolCalls && Array.isArray(toolCalls)) {
        for (const toolCall of toolCalls) {
          const result = await invokeToolFunction(
            event,
            directivesManager,
            toolCall.function.name,
            toolCall.function.arguments
          )
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `${result}`
          })
        }
      }
    }
    return "<无法获取 OpenAI 的回复>"
  } catch (e) {
    console.error(e)
    return "<与 OpenAI 的连接超时>"
  }
}
