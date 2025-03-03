import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"

export class GetStandardTimeTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "getDateTime",
        description: "获取当前时间（北京时间）",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false
        },
        strict: true
      }
    }
  }

  async invoke(context: ToolFunctionContext, params: any): Promise<string> {
    return new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai"
    })
  }
}
