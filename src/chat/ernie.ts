import { ChatCompletion, setEnvVariable } from "@baiducloud/qianfan"
import { Env } from "../utils/env/env"
import { ContextUnit } from "./types"
import { ChatCompletionMessageParam } from "openai/resources"
import { info } from "../utils/logging/logger"

setEnvVariable("QIANFAN_ACCESS_KEY", Env.ErnieAccessKey)
setEnvVariable("QIANFAN_SECRET_KEY", Env.ErnieSecretKey)

const client = new ChatCompletion()

function mergeUserQuestions(context: ContextUnit[]): ContextUnit[] {
  const mergedContext = []
  for (const unit of context) {
    if (mergedContext.length === 0) {
      mergedContext.push(unit)
      continue
    }

    const lastUnit = mergedContext[mergedContext.length - 1]

    if (unit.role === "user" && lastUnit.role === "user") {
      // Merge
      const lastName = lastUnit.name
      const lastContent = lastUnit.content
      if (lastUnit.name === "system") {
        lastUnit.content += `\n用户[${unit.name}]说：${unit.content}`
      } else {
        lastUnit.content = `用户[${lastName}]说：${lastContent}\n用户[${unit.name}]说：${unit.content}`
        lastUnit.name = "system"
      }
      continue
    }

    mergedContext.push(unit)
  }
  return mergedContext
}

function makeContext(
  groupChat: boolean,
  context: ContextUnit[]
): ChatCompletionMessageParam[] {
  context.unshift({
    role: "user",
    content:
      "你是文心一言。请你作为通讯平台KOOK的群聊的一员，参与大家的讨论。请总是给对话的最后一条以适当关注，那可能是用户对你的提问。",
    name: "system"
  } as ContextUnit)

  // 文心一言只支持一问一答
  context = mergeUserQuestions(context)

  if (groupChat) {
    const units = context.map((unit) => ({
      role: unit.role === "user" ? "user" : "assistant",
      content: unit.content,
      name: unit.name
    }))
    return [...(units as ChatCompletionMessageParam[])]
  }
  return [...context]
}

export async function chatCompletionWithoutStream(
  groupChat: boolean,
  context: ContextUnit[]
): Promise<string> {
  let messages = makeContext(groupChat, context)
  try {
    const resp = await client.chat(
      {
        messages: messages
      },
      "ERNIE-4.0-Turbo-8K"
    )
    console.log(resp)
    return resp.result
  } catch (e) {
    console.error(e)
    return "<与文心一言的连接超时>"
  }
}
