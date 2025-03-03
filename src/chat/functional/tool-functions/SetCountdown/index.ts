import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"
import { CardBuilder } from "../../../../helpers/card-helper"

export class SetCountdownTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "setCountdown",
        description: "设置一个倒计时",
        parameters: {
          type: "object",
          properties: {
            time: {
              type: "number",
              description: "倒计时间隔，单位为毫秒"
            }
          },
          required: ["time"],
          additionalProperties: false
        },
        strict: true
      }
    }
  }

  async invoke(context: ToolFunctionContext, params: any): Promise<string> {
    const { time } = params

    const endAt = Date.now() + time
    const card = CardBuilder.fromTemplate().addHourCountDown(endAt).build()
    context.directivesManager.respondCardMessageToUser({
      originalEvent: context.event,
      content: card
    })
    return "OK"
  }
}
