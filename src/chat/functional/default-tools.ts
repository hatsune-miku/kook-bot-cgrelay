import { ChatCompletionTool, FunctionParameters } from "openai/resources"
import { CardBuilder } from "../../helpers/card-helper"
import { ChatDirectivesManager } from "../directives"
import { KEvent, KTextChannelExtra } from "../../websocket/kwebsocket/types"
import { info } from "../../utils/logging/logger"

export const SetCountdownParameters: FunctionParameters = {
  type: "object",
  properties: {
    time: {
      type: "number",
      description: "倒计时间隔，单位为毫秒"
    }
  },
  required: ["time"],
  additionalProperties: false
}

export const EvaluateMathExpressionParameters: FunctionParameters = {
  type: "object",
  properties: {
    expression: {
      type: "string",
      description:
        "一个合法的 JavaScript 表达式，同样也可以使用 node 提供的全局对象如 Math, Date 等。请使用 oneliner"
    }
  },
  required: ["expression"],
  additionalProperties: false
}

export const DefaultChatCompletionTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "setCountdown",
      description: "设置一个倒计时",
      parameters: SetCountdownParameters,
      strict: true
    }
  },
  {
    type: "function",
    function: {
      name: "javaScriptEval",
      description: "等效于 JavaScript eval，赋予你执行代码的能力，请灵活运用",
      parameters: EvaluateMathExpressionParameters,
      strict: true
    }
  }
]

export const DefaultChatFunctions = {
  async setCountdown(
    originalEvent: KEvent<KTextChannelExtra>,
    directivesManager: ChatDirectivesManager,
    args: any
  ) {
    info(`[Chat] Set countdown`, args)
    const { time } = args

    const endAt = Date.now() + time
    const card = CardBuilder.fromTemplate().addHourCountDown(endAt).build()
    directivesManager.respondCardMessageToUser({
      originalEvent,
      content: card
    })
    info(`[Chat] Set countdown to`, endAt, originalEvent)
    return "OK"
  },
  async javaScriptEval(
    originalEvent: KEvent<KTextChannelExtra>,
    directivesManager: ChatDirectivesManager,
    args: any
  ) {
    info(`[Chat] Evaluate math expression`, args)
    const { expression } = args
    const result = eval(expression)
    return result
  }
}

export async function invokeToolFunction<T = any>(
  originalEvent: KEvent<KTextChannelExtra>,
  directivesManager: ChatDirectivesManager,
  name: string,
  params: any
): Promise<T | null> {
  let args = {}
  try {
    args = JSON.parse(params)
  } catch {
    return null
  }

  switch (name) {
    case "setCountdown":
      return (await DefaultChatFunctions.setCountdown(
        originalEvent,
        directivesManager,
        args
      )) as T

    case "javaScriptEval":
      return (await DefaultChatFunctions.javaScriptEval(
        originalEvent,
        directivesManager,
        args
      )) as T

    default:
      return null
  }
}
