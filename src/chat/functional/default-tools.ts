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

export const DefaultChatCompletionTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "setCountdown",
      description: "设置一个倒计时",
      parameters: SetCountdownParameters,
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

    default:
      return null
  }
}
