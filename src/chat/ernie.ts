import { ChatCompletion, setEnvVariable } from "@baiducloud/qianfan"
import { Env } from "../utils/env/env"
import { ContextUnit } from "./types"
import { ChatCompletionMessageParam } from "openai/resources"

setEnvVariable("QIANFAN_ACCESS_KEY", Env.ErnieAccessKey)
setEnvVariable("QIANFAN_SECRET_KEY", Env.ErnieSecretKey)

const client = new ChatCompletion()

function makeContext(
  groupChat: boolean,
  context: ContextUnit[]
): ChatCompletionMessageParam[] {
  if (context.length % 2 === 0) {
    // 文心一言要求奇数个对话
    context.push({
      role: "user",
      content: "请解答用户提问",
      name: "system"
    } as ContextUnit)
  }

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
