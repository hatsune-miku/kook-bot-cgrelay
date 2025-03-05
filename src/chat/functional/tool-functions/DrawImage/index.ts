import http from "http"
import https from "https"
import { ChatCompletionTool } from "openai/resources"
import { IFunctionTool } from "../dispatch"
import { ToolFunctionContext } from "../../context"
import { CardBuilder, CardIcons } from "../../../../helpers/card-helper"
import { createWriteStream } from "fs"
import { Requests } from "../../../../utils/krequest/request"
import { KEventType } from "../../../../websocket/kwebsocket/types"
import OpenAI from "openai"
import { draw } from "radash"
import { Env } from "../../../../utils/env/env"
import { CreateDownloadUrlTool } from "../CreateDownloadUrl"
import { shared } from "../../../../global/shared"

export class DrawImageTool implements IFunctionTool {
  async defineOpenAICompletionTool(): Promise<ChatCompletionTool> {
    return {
      type: "function",
      function: {
        name: "drawImage",
        description:
          "每当用户请求画图，你需要根据需求编写英文提示词，然后使用Dall·E 3进行绘画。绘画之前，你需自行检查prompt，如果你认为内容不适当，应该拒绝绘画并通过getModerationCheckNoticeText来获取拦截文案。",
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "英文prompt。如果用户的需求是其他语言，你需要依靠LLM自身能力将其翻译为英文。"
            }
          },
          required: ["prompt"],
          additionalProperties: false
        },
        strict: true
      }
    }
  }

  async invoke(context: ToolFunctionContext, params: any): Promise<string> {
    const { prompt } = params || {}
    const guildId = context.event.extra?.guild_id
    const channelId = context.event.target_id

    const openai = new OpenAI({
      apiKey: draw(Env.OpenAIKeys)!
    })

    const {
      code,
      message,
      data: sendResult
    } = await context.directivesManager.respondCardMessageToUser({
      originalEvent: context.event,
      content: CardBuilder.fromTemplate()
        .addIconWithKMarkdownText(CardIcons.MikuHappy, `Miku画画中...`)
        .build()
    })

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

    const result = await openai.images.generate({
      prompt: prompt,
      model: "dall-e-3",
      quality: "standard",
      response_format: "url",
      size: "1024x1024",
      style: "natural",
      n: 1
    })

    const image = result?.data[0]
    if (!image?.url) {
      return "绘画失败"
    }

    const fileName = `/tmp/dall-e-3-${Date.now()}.png`

    https.get(image.url, (response) => {
      const stream = createWriteStream(fileName).on("finish", async () => {
        const [url] = await Requests.uploadFile(fileName)
        const result = await context.directivesManager.respondCardMessageToUser(
          {
            originalEvent: context.event,
            content: CardBuilder.fromTemplate().addImage(url).build()
          }
        )
        if (result.code !== 0) {
          updateMessage(
            CardIcons.MikuHappy,
            `miku已绘画完成，但是发送消息失败\n\n\`${result.message}\``
          )
        } else {
          const message = `miku已绘画完成\n\n\`${prompt}\``
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
      })
      response.pipe(stream)
    })

    if (code !== 0) {
      return `发送消息失败: ${message}`
    }

    return "已调用 drawImage 完成并发送了绘画"
  }
}
