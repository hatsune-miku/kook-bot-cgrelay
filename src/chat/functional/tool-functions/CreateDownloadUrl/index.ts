import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"
import { CardBuilder } from "../../../../helpers/card-helper"

export class CreateDownloadUrlTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "createDownloadUrl",
        description: "根据本地临时文件，创建一个对应的https的下载链接",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "本地临时文件的绝对路径"
            }
          },
          required: ["path"],
          additionalProperties: false
        },
        strict: true
      }
    }
  }

  async invoke(context: ToolFunctionContext, params: any): Promise<string> {
    const { path } = params || {}

    if (!path) {
      return "错误的路径"
    }

    const fileName = path.split("/").pop()
    const fileNameEncoded = encodeURIComponent(fileName)
    const downloadUrl = `https://www.k00kapp.cn/kook/api/v1/download?file=${fileNameEncoded}`
    return downloadUrl
  }
}
