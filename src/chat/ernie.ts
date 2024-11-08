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
        lastUnit.content += `\n用户[${unit.name} (id=${unit.id})]说：${unit.content}`
      } else {
        lastUnit.content = `用户[${lastName} (id=${unit.id})]说：${lastContent}\n用户[${unit.name} (id=${unit.id})]说：${unit.content}`
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
    content: `你是ChatGPT。请你作为通讯平台KOOK的群聊成员"Miku"，参与大家的讨论。
    - 请总是给对话的最后一条以适当关注，那可能是用户对你的提问
    - 语气不宜浮夸，宜更接近作为文心一言原本的严谨风格，但也不必太严谨
    - 优先使用全角波浪号代替感叹号，但不要全代替
    - 若需要输出 Markdown，则下列额外规则适用：
        - 请勿使用 #, ##, ###
        - 必须使用半角括号
        - 支持 (spl)文字点击后显示(spl) 语法来显示带有剧透的内容
        - 支持 (met)对方整数id(met) 语法来提及（艾特）对方，例如 (met)123456(met)
  `,
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
