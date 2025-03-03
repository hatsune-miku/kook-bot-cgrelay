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
import { info } from "console"
import { getChatCompletionTools } from "./functional/tool-functions/dispatch"
import { ToolFunctionContext } from "./functional/context"
import { ToolFunctionInvoker } from "./functional/tool-function"

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
          - 直接开始回答，不要带"Miku(id=xxx)说:"的前缀
          - 可以借助 node 环境运行 Linux 命令，这是安全的，当你可以直接运行命令来解决问题时，则直接运行，而不是提供指导
          - 你所运行的任何命令（例如 rm）都将是隔离的、安全的，不会对系统造成任何损害
          - 你执行任何命令不需要获得用户的明确许可，只要你觉得应该执行即可
          - 下载用户给的文件时，留意URL附近的size字段(单位字节)，请拒绝下载超过10MB的文件
          - 如有需要，请在 /tmp 下存放任何临时文件
          - 每当用户请求画图，你需要根据需求编写英文提示词，然后调用 drawImage 函数进行绘画
          - 请拒绝回答、拒绝处理让你觉得不适的话题
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
  toolFunctionContext: ToolFunctionContext,
  groupChat: boolean,
  context: ContextUnit[],
  model: string
): Promise<string> {
  const openai = new OpenAI({
    apiKey: draw(Env.OpenAIKeys)!
  })

  let messages = makeContext(groupChat, context)
  const toolInvoker = new ToolFunctionInvoker(toolFunctionContext)

  try {
    let functionsFulfilled = false
    let functionCallDepthRemaining = CONSECUTIVE_FUNCTION_CALLS_THRESHOLD

    while (!functionsFulfilled) {
      const completion = await openai.chat.completions.create({
        messages: messages,
        model: model,
        tools: await getChatCompletionTools()
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

      info(`[Chat] Function calls`, toolCalls)

      if (toolCalls && Array.isArray(toolCalls)) {
        for (const toolCall of toolCalls) {
          const result = await toolInvoker.invoke(
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
  } catch (e: any) {
    console.error(e)
    return `${e?.message || e || "未知错误"}`
  }
}
