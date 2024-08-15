import { ChatCompletion, setEnvVariable } from "@baiducloud/qianfan"
import { Env } from "../utils/env/env"
import { ContextUnit } from "./types"
import { ChatCompletionMessageParam } from "openai/resources"

setEnvVariable("QIANFAN_ACCESS_KEY", Env.ErnieAccessKey)
setEnvVariable("QIANFAN_SECRET_KEY", Env.ErnieSecretKey)

const client = new ChatCompletion()

function mergeUserQuestions(context: ContextUnit[]): ContextUnit[] {
  const mergedContext = [...context]
  for (let i = 0; i < mergedContext.length - 1; i++) {
    if (
      mergedContext[i].role === "user" &&
      mergedContext[i + 1].role === "user"
    ) {
      mergedContext[
        i
      ].content = `${mergedContext[i].name}说：${mergedContext[i].content}`
      mergedContext[i].content += `\n${mergedContext[i + 1].name}说：${
        mergedContext[i + 1].content
      }`
      mergedContext[i].name = "system"
      mergedContext.splice(i + 1, 1)
    }
  }
  return mergedContext
}

function makeContext(
  groupChat: boolean,
  context: ContextUnit[]
): ChatCompletionMessageParam[] {
  // 文心一言只支持一问一答
  context = mergeUserQuestions(context)

  if (context.length % 2 === 0) {
    // 文心一言要求奇数个对话
    context.unshift({
      role: "assistant",
      content: "你好，我是文心一言。"
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
