import { info } from "../../utils/logging/logger"
import { ToolFunctionContext } from "./context"
import { dispatchTool } from "./tool-functions/dispatch"

export class ToolFunctionInvoker {
  constructor(private context: ToolFunctionContext) {}

  async invoke(name: string, params: any): Promise<string> {
    const tool = dispatchTool(name)
    if (!tool) {
      info(`[ToolFunctionInvoker] Tool not found: ${name}`)
    }

    try {
      if (typeof params === "string") {
        params = JSON.parse(params)
      }
    } catch {
      info(
        `[ToolFunctionInvoker] Failed to parse params: ${JSON.stringify(
          params
        )}`
      )
      return "调用失败：JSON parse failed"
    }
    return await tool.invoke(this.context, params)
  }
}
