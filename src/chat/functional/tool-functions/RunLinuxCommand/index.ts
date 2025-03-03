import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"
import { CardBuilder, CardIcons } from "../../../../helpers/card-helper"
import { sleep } from "radash"
import { EvaluateJavaScriptTool } from "../EvaluateJavaScript"
import { execSync } from "child_process"

export class RunLinuxCommandTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "runLinuxCommand",
        description:
          "运行一个 Linux 命令。可以是任何合法命令甚至是危险命令，这些总是运行在安全的沙盒环境中。",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "一个 Linux (Bash) 命令。你可假设任何工具都已安装。"
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
    const { expression, showCommand = true } = params

    if (showCommand) {
      const card = CardBuilder.fromTemplate()
        .addIconWithKMarkdownText(
          CardIcons.MikuCute,
          `已执行:\n\`\`\`bash\n${expression}\n\`\`\``
        )
        .build()
      context.directivesManager.respondCardMessageToUser({
        originalEvent: context.event,
        content: card
      })
      await sleep(100)
    }
    try {
      return execSync(expression).toString()
    } catch (e: any) {
      return "命令执行失败，错误信息：" + (e?.message || "unknown")
    }
  }
}
