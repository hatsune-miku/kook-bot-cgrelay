import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"
import { info } from "../../../../utils/logging/logger"

export class ModerationCheckNoticeTextTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "getModerationCheckNoticeText",
        description:
          "如果你认为用户的prompt将无法通过安全审查（例如含有危险内容等），调用此函数来获取一段文案，然后原封不动地展示给用户看。",
        parameters: {
          type: "object",
          properties: {
            confidence: {
              type: "number",
              description:
                "置信度，你有多大把握认为这段prompt是不安全的。范围：闭区间 [0,100]"
            },
            originalPrompt: {
              type: "string",
              description: "用户的原始prompt"
            }
          },
          required: ["confidence", "originalPrompt"],
          additionalProperties: false
        },
        strict: true
      }
    }
  }

  async invoke(context: ToolFunctionContext, params: any): Promise<string> {
    const { confidence, originalPrompt } = params || {}
    info(
      `Moderation check confidence: ${confidence}, original prompt: [${originalPrompt}]`
    )

    return `这段绘画请求的内容可能包含不被允许的内容，因此没有交给绘画AI处理。建议使用本地私有部署模型来获取完整体验，因为在线运营的AI对内容审查非常严格。\n\n置信度：${confidence}%`
  }
}
