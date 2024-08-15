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
import { Events, KCardMessage, RespondToUserParameters } from "./events"
import { displayNameFromUser } from "./utils"
import ConfigUtils from "./utils/config/config"
import { ChatBotBackend, GroupChatStrategy } from "./chat/types"

const botEventEmitter = new EventEmitter()
const contextManager = new ContextManager()
const roleManager = new GuildRoleManager()
const directivesManager = new ChatDirectivesManager(botEventEmitter)

directivesManager.setContextManager(contextManager)

export async function main() {
  ConfigUtils.initialize()
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
  const guildId = event.extra.guild_id
  const myRoles = await roleManager.getMyRolesAt(guildId, shared.me.id)
  const isSentByMe = event.author_id == shared.me.id

  if (isSentByMe) {
    return
  }

  const content = extractContent(event)
  const author = event.extra.author
  const displayName = displayNameFromUser(author)
  const isMentioningMe = isExplicitlyMentioningBot(event, shared.me.id, myRoles)
  const groupChatStrategy = directivesManager.getGroupChatStrategy()

  info(displayName, "said:", content)

  // 无情开搓模式无视其它设置
  if (directivesManager.isSuperKookModeEnabled()) {
    // 40%
    if (Math.random() < 0.4) {
      Requests.reactToMessage(
        event.msg_id,
        "[:dddd:3266153385602000/6dZZoQvszK034034]"
      ).then((res) => {
        info(res)
        if (!res.success) {
          error(
            "Failed to react to message",
            event.msg_id,
            "reason:",
            res.message
          )
        }
      })
    }
  }

  // @我或者可以免除@我，都可以处理指令
  if (
    isMentioningMe ||
    directivesManager.isAllowOmittingMentioningMeEnabled()
  ) {
    // Process directives
    directivesManager.tryInitializeForUser(author)
    const parsedEvent = await directivesManager.tryParseEvent(content, event)
    if (parsedEvent.shouldIntercept) {
      info("It's a directive. Processing...")
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
    type: KEventType.KMarkdown,
    target_id: event.target_id,
    content: `稍等，正在生成回复...`,
    quote: event.msg_id
  })

  if (!sendResult.success) {
    error("Failed to respond to", displayName, "reason:", sendResult.message)
    return
  }

  const isGroupChat = groupChatStrategy !== GroupChatStrategy.Off
  const createdMessage = sendResult.data
  const context = isGroupChat
    ? contextManager.getMixedContext(guildId, shouldIncludeFreeChat)
    : contextManager.getContext(guildId, author.id)

  info("context", context)

  const backend =
    directivesManager.getChatBotBackend() === ChatBotBackend.ChatGPT
      ? chatCompletionWithoutStreamChatGPT
      : chatCompletionWithoutStreamErnie
  const modelResponse = await backend(isGroupChat, context)

  info("model response", modelResponse)
  contextManager.appendToContext(
    guildId,
    author.id,
    "ChatGPT",
    "assistant",
    modelResponse,
    false
  )

  const performUpdateMessage = () =>
    Requests.updateChannelMessage({
      msg_id: createdMessage.msg_id,
      content: modelResponse,
      quote: event.msg_id
    })

  const updateResult = await performUpdateMessage()
  setTimeout(performUpdateMessage, 3000)

  if (!updateResult.success) {
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
