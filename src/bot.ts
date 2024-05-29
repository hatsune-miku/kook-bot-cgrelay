/*
 * @Path          : \kook-bot-cgrelay\src\bot.ts
 * @Created At    : 2024-05-21 17:13:02
 * @Last Modified : 2024-05-29 19:05:55
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { ContextManager } from "./chat/context-manager"
import { chatCompletionWithoutStream } from "./chat/openai"
import { ChatDirectivesManager } from "./chat/directives"
import { shared } from "./global/shared"
import { extractContent, isExplicitlyMentioningBot } from "./utils/kevent/utils"
import { Requests } from "./utils/krequest/request"
import { error, info, warn } from "./utils/logging/logger"
import { die } from "./utils/server/die"
import { GuildRoleManager } from "./websocket/kwebsocket/guild-role-manager"
import { KWSHelper } from "./websocket/kwebsocket/kws-helper"
import { KEvent, KEventType, KSystemEventExtra, KTextChannelExtra, KUser } from "./websocket/kwebsocket/types"
import { EventEmitter } from "stream"
import { Events, RespondToUserParameters } from "./events"
import { displayNameFromUser } from "./utils"

const botEventEmitter = new EventEmitter()

const manager = new ContextManager()
const roleManager = new GuildRoleManager()
const directivesManager = new ChatDirectivesManager(botEventEmitter)

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

    info("Initialization OK")
}

async function handleRespondToUserEvent(event: RespondToUserParameters) {
    const result = await Requests.createChannelMessage({
        type: KEventType.KMarkdown,
        target_id: event.originalEvent.target_id,
        content: event.content,
        quote: event.originalEvent.msg_id,
    })

    if (!result.success) {
        error("Failed to respond to", displayNameFromUser(event.originalEvent.extra.author),
            "reason:", result.message)
    }
}

async function tryPrepareBotInformation() {
    info("Querying self information from KOOK...")
    const querySelfResult = await Requests.queryWhoAmI()
    const whoAmI = querySelfResult.data

    if (!querySelfResult.success) {
        die(`Query-self failed: ${querySelfResult.message}`)
        return
    }
    if (!whoAmI.bot) {
        warn(`KOOK said I am NOT a bot. 震惊.`)
    }

    const displayName = `${whoAmI.username}#${whoAmI.identify_num}`
    info("I am", displayName, "with user id", whoAmI.id)

    shared.me = whoAmI
}

function handleSevereError(message: string) {
    die(`A severe error occured and bot must exit: ${message}`)
}

async function handleTextChannelEvent(event: KEvent<KTextChannelExtra>) {
    const guildId = event.extra.guild_id
    const myRoles = await roleManager.getMyRolesAt(guildId, shared.me.id)

    if (!isExplicitlyMentioningBot(event, shared.me.id, myRoles)) {
        return
    }

    const content = extractContent(event)
    const author = event.extra.author
    const displayName = displayNameFromUser(author)
    info(displayName, 'said to me:', content)

    // Process directives
    directivesManager.tryInitializeForUser(author)
    const parsedEvent = await directivesManager.tryParseEvent(content, event)
    if (parsedEvent.shouldIntercept) {
        parsedEvent.mentionUserIds = parsedEvent.mentionUserIds.filter(id => id !== shared.me.id)
        parsedEvent.mentionRoleIds = parsedEvent.mentionRoleIds.filter(rid => !myRoles.includes(rid))
        directivesManager.dispatchDirectives(parsedEvent)
        return
    }

    manager.appendToContext(author.id, 'user', content)

    const sendResult = await Requests.createChannelMessage({
        type: KEventType.KMarkdown,
        target_id: event.target_id,
        content: `稍等，正在生成回复...`,
        quote: event.msg_id,
    })

    if (!sendResult.success) {
        error("Failed to respond to", displayName, "reason:", sendResult.message)
        return
    }

    const createdMessage = sendResult.data
    const context = directivesManager.isGroupChatEnabled()
        ? manager.getMixedContext()
        : manager.getContext(author.id)
    const modelResponse = await chatCompletionWithoutStream(
        author.nickname,
        context,
    )

    info('model response', modelResponse)
    manager.appendToContext(author.id, 'assistant', modelResponse)

    const updateResult = await Requests.updateChannelMessage({
        msg_id: createdMessage.msg_id,
        content: modelResponse,
        quote: event.msg_id,
    })

    if (!updateResult.success) {
        error("Failed to update message", createdMessage.msg_id, "reason:", updateResult.message)
        return
    }
}

function handleSystemEvent(_: KEvent<KSystemEventExtra>) {

}

function handleReset() {

}
