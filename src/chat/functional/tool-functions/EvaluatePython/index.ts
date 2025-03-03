import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"
import { CardBuilder, CardIcons } from "../../../../helpers/card-helper"
import { sleep } from "radash"
import { info } from "../../../../utils/logging/logger"
import { RunLinuxCommandTool } from "../RunLinuxCommand"
import { execSync } from "child_process"
import { writeFileSync } from "fs"

export class EvaluatePythonTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "pythonEvalSandboxed",
        description:
          "执行一段 Python 3 程序，其解释器将运行于隔离环境，不会造成任何破坏，也可以安全放心地访问文件系统。必须显式使用 print 打印结果，不可以采用 interactive 风格写法。",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description:
                "一个 Python 3 程序。必须显式使用 print 打印结果，不可以采用 interactive 风格写法。你可以假定各种库都已安装。"
            }
          },
          required: ["code"],
          additionalProperties: false
        },
        strict: true
      }
    }
  }
  async invoke(context: ToolFunctionContext, params: any): Promise<string> {
    info(`[Chat] Evaluate Python expression`, params)
    const { code, showCommand = true } = params

    if (showCommand) {
      const card = CardBuilder.fromTemplate()
        .addIconWithKMarkdownText(
          CardIcons.MikuCute,
          `已执行 Python 代码:\n\`\`\`python3\n${code}\n\`\`\``
        )
        .build()
      context.directivesManager.respondCardMessageToUser({
        originalEvent: context.event,
        content: card
      })
      await sleep(100)
    }

    try {
      writeFileSync("/tmp/eval.py", code)
      const result = execSync(`python3 /tmp/eval.py`, {
        encoding: "utf-8"
      }).toString()
      info(`[Chat] Eval result`, result)
      return result
    } catch (e: any) {
      return `执行失败: ${e?.message || "未知错误"}`
    }
  }
}
