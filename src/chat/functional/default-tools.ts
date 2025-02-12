import { ChatCompletionTool, FunctionParameters } from "openai/resources"
import { CardBuilder } from "../../helpers/card-helper"
import { ChatDirectivesManager } from "../directives"
import { KEvent, KTextChannelExtra } from "../../websocket/kwebsocket/types"

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
    { time }: { time: number }
  ) {
    const endAt = Date.now() + time
    const card = CardBuilder.fromTemplate().addHourCountDown(endAt).build()
    directivesManager.respondCardMessageToUser({
      originalEvent,
      content: card
    })
    return "OK"
  }
}

export async function invokeToolFunction<T = any>(
  originalEvent: KEvent<KTextChannelExtra>,
  directivesManager: ChatDirectivesManager,
  name: string,
  params: any
): Promise<T | null> {
  switch (name) {
    case "setCountdown":
      return (await DefaultChatFunctions.setCountdown(
        originalEvent,
        directivesManager,
        params
      )) as T

    default:
      return null
  }
}
