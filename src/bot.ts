/*
 * @Path          : \kook-bot-cgrelay\src\bot.ts
 * @Created At    : 2024-05-21 17:13:02
 * @Last Modified : 2024-05-30 14:13:23
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { ContextManager } from "./chat/context-manager"
import { chatCompletionWithoutStream as chatCompletionWithoutStreamChatGPT } from "./chat/openai"
import { chatCompletionWithoutStream as chatCompletionWithoutStreamErnie } from "./chat/ernie"
import { ChatDirectivesManager } from "./chat/directives"
import { shared } from "./global/shared"
import { extractContent, isExplicitlyMentioningBot } from "./utils/kevent/utils"
import { Requests } from "./utils/krequest/request"
import { error, info, warn } from "./utils/logging/logger"
import { die } from "./utils/server/die"
import { GuildRoleManager } from "./websocket/kwebsocket/guild-role-manager"
import { KWSHelper } from "./websocket/kwebsocket/kws-helper"
import {
  KEvent,
  KEventType,
  KSystemEventExtra,
  KTextChannelExtra
} from "./websocket/kwebsocket/types"
import { EventEmitter } from "stream"
import { Events, RespondToUserParameters } from "./events"
import { displayNameFromUser, isTrustedUser } from "./utils"
import ConfigUtils from "./utils/config/config"
import { ChatBotBackend, ContextUnit, GroupChatStrategy } from "./chat/types"
import { CardBuilder } from "./helpers/card-helper"

ConfigUtils.initialize()

const botEventEmitter = new EventEmitter()
const contextManager = new ContextManager()
const roleManager = new GuildRoleManager()
const directivesManager = new ChatDirectivesManager(botEventEmitter)

directivesManager.setContextManager(contextManager)

export async function main() {
  await tryPrepareBotInformation()

  const helper = new KWSHelper({
    onSevereError: handleSevereError,
    onTextChannelEvent: handleTextChannelEvent,
    onSystemEvent: handleSystemEvent,
    onReset: handleReset
  })
  helper.startWebsocket()

  botEventEmitter.on(Events.RespondToUser, handleRespondToUserEvent)
  botEventEmitter.on(
    Events.RespondCardMessageToUser,
    handleRespondCardMessageToUserEvent
  )

  info("Initialization OK")
}

export function deinitialize() {
  ConfigUtils.persist()
}

async function handleRespondToUserEvent(event: RespondToUserParameters) {
  const result = await Requests.createChannelMessage({
    type: KEventType.KMarkdown,
    target_id: event.originalEvent.target_id,
    content: event.content,
    quote: event.originalEvent.msg_id
  })

  if (!result.success) {
    error(
      "Failed to respond to",
      displayNameFromUser(event.originalEvent.extra.author),
      "reason:",
      result.message
    )
  }
}

async function handleRespondCardMessageToUserEvent(
  event: RespondToUserParameters
) {
  const result = await Requests.createChannelMessage({
    type: KEventType.Card,
    target_id: event.originalEvent.target_id,
    content: event.content,
    quote: event.originalEvent.msg_id
  })

  if (!result.success) {
    error(
      "Failed to respond to",
      displayNameFromUser(event.originalEvent.extra.author),
      "reason:",
      result.message
    )
  }
}

async function tryPrepareBotInformation() {
  info("Querying self information from KOOK...")
  const querySelfResult = await Requests.querySelfUser()
  const self = querySelfResult.data

  if (!querySelfResult.success) {
    // 写php写的
    die(`Query-self failed: ${querySelfResult.message}`)
  }

  if (!self.bot) {
    warn(`KOOK说我不是bot，震惊!`)
  }

  const displayName = `${self.username}#${self.identify_num}`
  info("I am", displayName, "with user id", self.id)

  shared.me = self
}

function handleSevereError(message: string) {
  die(`A severe error occured and bot must exit: ${message}`)
}

async function handleTextChannelEvent(event: KEvent<KTextChannelExtra>) {
  const guildId = event.extra?.guild_id
  const channelId = event.target_id

  if (!guildId) {
    return
  }

  const myRoles = await roleManager.getMyRolesAt(guildId, shared.me.id)
  const isSentByMe = event.author_id == shared.me.id

  if (isSentByMe) {
    return
  }
  const content = extractContent(event)
  const author = event.extra.author
  const displayName = displayNameFromUser(author)
  const isMentioningMe = isExplicitlyMentioningBot(event, shared.me.id, myRoles)
  const groupChatStrategy = directivesManager.getGroupChatStrategy(
    guildId,
    channelId
  )
  const calledByTrustedUser = isTrustedUser(event.extra.author.id)
  const whitelisted =
    (ConfigUtils.getGlobalConfig().whiteListedGuildIds ?? {}).hasOwnProperty(
      guildId
    ) || calledByTrustedUser

  if (isMentioningMe && !whitelisted) {
    await Requests.createChannelMessage({
      type: KEventType.KMarkdown,
      target_id: event.target_id,
      content: `miku 机器人还在内测中，当前服务器 (${guildId}) 未在白名单。有意请联系 (met)3553226959(met)~`,
      quote: event.msg_id
    })
    return
  }

  // @我或者可以免除@我，都可以处理指令
  if (
    isMentioningMe ||
    directivesManager.isAllowOmittingMentioningMeEnabled(guildId, channelId)
  ) {
    // Process directives
    directivesManager.tryInitializeForUser(guildId, author)
    const parsedEvent = await directivesManager.tryParseEvent(content, event)
    if (parsedEvent.shouldIntercept) {
      if (!whitelisted) {
        return
      }

      parsedEvent.mentionUserIds = parsedEvent.mentionUserIds.filter(
        (id) => id !== shared.me.id
      )
      parsedEvent.mentionRoleIds = parsedEvent.mentionRoleIds.filter(
        (rid) => !myRoles.includes(rid)
      )
      directivesManager.dispatchDirectives(parsedEvent)
      return
    }
  }

  const shouldIncludeFreeChat = groupChatStrategy === GroupChatStrategy.Normal
  contextManager.appendToContext(
    guildId,
    channelId,
    author.id,
    author.nickname,
    "user",
    content,
    !isMentioningMe
  )

  // 只有明确@我的消息才会被交给ChatGPT
  if (!isMentioningMe) {
    return
  }

  const sendResult = await Requests.createChannelMessage({
    type: KEventType.Card,
    target_id: event.target_id,
    content: CardBuilder.fromTemplate()
      .addIconWithText(
        "https://img.kookapp.cn/assets/2024-11/08/j9AUs4J16i04s04y.png",
        "miku打字中..."
      )
      .build(),
    quote: event.msg_id
  })

  if (!sendResult.success) {
    error("Failed to respond to", displayName, "reason:", sendResult.message)
    return
  } else {
    info("Successfully responded to", displayName, sendResult, sendResult.data)
  }

  const isGroupChat = groupChatStrategy !== GroupChatStrategy.Off
  const createdMessage = sendResult.data
  const context = isGroupChat
    ? contextManager.getMixedContext(guildId, channelId, shouldIncludeFreeChat)
    : contextManager.getContext(guildId, channelId, author.id)

  const backendModelName = directivesManager.getChatBotBackend(
    guildId,
    channelId
  )
  const backend =
    directivesManager.getChatBotBackend(guildId, channelId) ===
    ChatBotBackend.Ernie
      ? chatCompletionWithoutStreamErnie
      : (groupChat: boolean, context: ContextUnit[]) =>
          chatCompletionWithoutStreamChatGPT(
            groupChat,
            context,
            backendModelName
          )
  const modelResponse = await backend(isGroupChat, context)

  info("model response", modelResponse)
  contextManager.appendToContext(
    guildId,
    channelId,
    shared.me.id,
    "Miku",
    "assistant",
    modelResponse,
    false
  )

  const performUpdateMessage = () =>
    Requests.updateChannelMessage({
      msg_id: createdMessage.msg_id,
      content: CardBuilder.fromTemplate()
        .addIconWithText(
          "https://img.kookapp.cn/assets/2024-11/08/j9AUs4J16i04s04y.png",
          ""
        )
        .addKMarkdownText(modelResponse)
        .build(),
      quote: event.msg_id,
      extra: {
        type: KEventType.KMarkdown,
        target_id: event.target_id
      }
    })

  const updateResult = await performUpdateMessage()

  if (!updateResult.success || updateResult.code !== 0) {
    Requests.updateChannelMessage({
      msg_id: createdMessage.msg_id,
      content: CardBuilder.fromTemplate()
        .addIconWithText(
          "https://img.kookapp.cn/assets/2024-11/08/j9AUs4J16i04s04y.png",
          "消息发送失败了！"
        )
        .addKMarkdownText(
          `刚才的消息没能发成功，因为【${updateResult.message}】~`
        )
        .build(),
      quote: event.msg_id,
      extra: {
        type: KEventType.KMarkdown,
        target_id: event.target_id
      }
    })
    error(
      "Failed to update message",
      createdMessage.msg_id,
      "reason:",
      updateResult.message
    )
    return
  }
}

function handleSystemEvent(_: KEvent<KSystemEventExtra>) {}

function handleReset() {}
