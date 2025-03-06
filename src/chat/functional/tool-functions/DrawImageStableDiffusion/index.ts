import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"
import { CardBuilder, CardIcons } from "../../../../helpers/card-helper"
import { writeFileSync } from "fs"
import { Requests } from "../../../../utils/krequest/request"
import { KEventType } from "../../../../websocket/kwebsocket/types"
import { draw } from "radash"
import { Env } from "../../../../utils/env/env"
import { shared } from "../../../../global/shared"
import { info } from "../../../../utils/logging/logger"
import FormData from "form-data"
import fetch from "node-fetch"

export class DrawImageStableDiffusionTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "drawImage",
        description:
          "每当用户请求画图，你需要根据需求编写英文提示词，然后使用Stable Diffusion进行绘画。绘画之前，你需自行检查prompt，如果你认为内容不适当，应该拒绝绘画并通过getModerationCheckNoticeText来获取拦截文案。",
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "英文prompt。如果用户的需求是其他语言，你需要依靠LLM自身能力将其翻译为英文。"
            },
            negative_prompt: {
              type: "string",
              description:
                "负面prompt。如果用户没明确指定，你可以自行发挥或者采用空字符串。"
            }
          },
          required: ["prompt", "negative_prompt"],
          additionalProperties: false
        },
        strict: true
      }
    }
  }

  async invoke(context: ToolFunctionContext, params: any): Promise<string> {
    const { prompt, negative_prompt } = params || {}
    const guildId = context.event.extra?.guild_id
    const channelId = context.event.target_id

    const {
      code,
      message,
      data: sendResult
    } = await context.directivesManager.respondCardMessageToUser({
      originalEvent: context.event,
      content: CardBuilder.fromTemplate()
        .addIconWithKMarkdownText(CardIcons.MikuHappy, `miku画画中...`)
        .build()
    })

    if (code !== 0) {
      return `发送消息失败: ${message}`
    }

    const updateMessage = (iconUrl: string, content: string) => {
      Requests.updateChannelMessage({
        msg_id: sendResult.msg_id,
        content: CardBuilder.fromTemplate()
          .addIconWithKMarkdownText(iconUrl, content)
          .build(),
        quote: context.event.msg_id,
        extra: {
          type: KEventType.KMarkdown,
          target_id: context.event.target_id
        }
      })
    }

    let res: fetch.Response
    try {
      const token = draw(Env.StableDiffusionKeys)
      info("DrawImageTool", `Stable Diffusion token: ${token}`)

      const form = new FormData()
      form.append("prompt", prompt)
      form.append("negative_prompt", negative_prompt)
      form.append("output_format", "jpeg")
      form.append("mode", "text-to-image")
      form.append("model", "sd3.5-large-turbo")

      res = await fetch(
        "https://api.stability.ai/v2beta/stable-image/generate/sd3",
        {
          method: "POST",
          headers: {
            ...form.getHeaders(),
            authorization: `Bearer ${token}`,
            accept: "image/*"
          },
          body: form
        }
      )
    } catch (e: any) {
      info("DrawImageTool", `Stable Diffusion error: ${e.message}`, e)
      return `绘画失败: ${e.message}`
    }
    info("DrawImageTool", `Stable Diffusion response: ${res}`, res)

    const data = await res.arrayBuffer()
    const fileName = `/tmp/stable-diffusion-${Date.now()}.jpeg`
    writeFileSync(fileName, Buffer.from(data))

    const [url] = await Requests.uploadFile(fileName)
    info("DrawImageTool", `Uploaded file: ${url}`)

    const result = await context.directivesManager.respondCardMessageToUser({
      originalEvent: context.event,
      content: CardBuilder.fromTemplate().addImage(url).build()
    })
    if (result.code !== 0) {
      updateMessage(
        CardIcons.MikuHappy,
        `miku已绘画完成，但是发送消息失败\n\n\`${result.message}\``
      )
    } else {
      const message = `miku已绘画完成\n\n提示词\n\`${prompt}\`\n\n负面提示词\n\`${negative_prompt}\``
      updateMessage(CardIcons.MikuHappy, message)
      context.contextManager.appendToContext(
        guildId,
        channelId,
        shared.me.id,
        sendResult.msg_id,
        "Miku",
        "assistant",
        message,
        true
      )
    }
    return "已调用 drawImage 完成并发送了绘画"
  }
}
