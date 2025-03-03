import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"
import { CardBuilder, CardIcons } from "../../../../helpers/card-helper"
import { sleep } from "radash"
import { info } from "../../../../utils/logging/logger"

export class EvaluateJavaScriptTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "javaScriptEvalSandboxed",
        description:
          "与 JavaScript eval 用法相同，但运行于隔离的node环境，不会造成任何破坏、也可以安全放心地访问文件系统，或是运行任何 Linux 命令。",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description:
                "一个合法的 JavaScript 表达式，同样也可以使用 node 提供的全局对象如 Math, Date 等"
            }
          },
          required: ["expression"],
          additionalProperties: false
        },
        strict: true
      }
    }
  }
  async invoke(context: ToolFunctionContext, params: any): Promise<string> {
    info(`[Chat] Evaluate js expression`, params)
    const { expression, showCommand = true } = params

    if (showCommand) {
      const card = CardBuilder.fromTemplate()
        .addIconWithKMarkdownText(
          CardIcons.MikuCute,
          `已执行 JavaScript 代码:\n\`\`\`js\n${expression}\n\`\`\``
        )
        .build()
      context.directivesManager.respondCardMessageToUser({
        originalEvent: context.event,
        content: card
      })
      await sleep(100)
    }

    try {
      const result = eval(expression)
      info(`[Chat] Eval result`, result)
      return result
    } catch (e: any) {
      return `执行失败: ${e?.message || "未知错误"}`
    }
  }
}
