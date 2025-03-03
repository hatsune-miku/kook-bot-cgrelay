import { EventEmitter } from "stream"
import { error, info, warn } from "../utils/logging/logger"
import { KEvent, KTextChannelExtra, KUser } from "../websocket/kwebsocket/types"
import { Events, KCardMessage, RespondToUserParameters } from "../events"
import { displayNameFromUser, isTrustedUser } from "../utils"
import { RequestMethod, Requests } from "../utils/krequest/request"
import { map } from "radash"
import ConfigUtils from "../utils/config/config"
import { ContextManager } from "./context-manager"
import { ChatBotBackend, ContextUnit, GroupChatStrategy } from "./types"
import { IChatDirectivesManager } from "./interfaces"
import yukiSubCommandHandler from "./yuki/handler"
import { CardBuilder, CardIcons } from "../helpers/card-helper"
import {
  CreateChannelMessageResult,
  KResponseExt
} from "../utils/krequest/types"

export class ChatDirectivesManager implements IChatDirectivesManager {
  private guildIdToUserIdToProperties = new Map<
    string,
    Map<string, UserProperties>
  >()
  private contextManager: ContextManager | null = null

  constructor(private eventEmitter: EventEmitter) {}

  respondToUser(
    params: RespondToUserParameters
  ): Promise<KResponseExt<CreateChannelMessageResult>> {
    return new Promise((resolve) => {
      this.eventEmitter.emit(Events.RespondToUser, params, resolve)
    })
  }

  respondCardMessageToUser(
    params: RespondToUserParameters
  ): Promise<KResponseExt<CreateChannelMessageResult>> {
    return new Promise((resolve) => {
      this.eventEmitter.emit(Events.RespondCardMessageToUser, params, resolve)
    })
  }

  handleGroupChat(event: ParseEventResultValid) {
    const guildId = event.originalEvent.extra.guild_id
    const channelId = event.originalEvent.target_id

    if (event.parameter === "normal") {
      this.setGroupChatStrategy(guildId, channelId, GroupChatStrategy.Normal)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "好欸！已启用群聊模式！"
      })
    } else if (event.parameter === "legacy") {
      this.setGroupChatStrategy(guildId, channelId, GroupChatStrategy.Legacy)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "已启用传统群聊模式！仅@我的消息会被计算。"
      })
    } else if (event.parameter === "off") {
      this.setGroupChatStrategy(guildId, channelId, GroupChatStrategy.Off)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "好！已关闭群聊模式！"
      })
    } else {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "参数不合法，应该输入 normal, legacy 或者 off"
      })
    }
  }

  async handleAssignRole(event: ParseEventResultValid) {
    if (event.mentionUserIds.length === 0 && event.mentionRoleIds.length > 0) {
      // 用户常见的错误，@到role而非具体用户
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "你应该@具体用户，而不是@某个服务器角色，注意区分哦"
      })
      return
    }

    const role = event.parameter
    if (!role) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "权限不能为空"
      })
      return
    }

    const mentionedUsers = await map(
      event.mentionUserIds,
      async (userId) =>
        await this.getUser(userId, event.originalEvent.extra.guild_id)
    )

    mentionedUsers.forEach((user) => {
      this.assignRole(user, role)
    })

    mentionedUsers.forEach((user) => {
      ConfigUtils.updateGuildConfig(
        event.originalEvent.extra.guild_id,
        (config) => {
          if (!config) {
            return config
          }
          config.users ||= {}
          config.users[user.metadata.id] ||= {}
          config.users[user.metadata.id]!.roles = user.roles
          return config
        }
      )
    })

    const displayNames = mentionedUsers.map((user) =>
      displayNameFromUser(user.metadata)
    )

    this.respondToUser({
      originalEvent: event.originalEvent,
      content: `好耶！已将 ${role} 授予 ${
        displayNames.length
      } 位用户: ${displayNames.join(", ")}`
    })
  }

  async handleRevokeRole(event: ParseEventResultValid) {
    if (event.mentionUserIds.length === 0 && event.mentionRoleIds.length > 0) {
      // 用户常见的错误，@到role而非具体用户
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "你应该@具体用户，而不是@某个服务器角色，注意区分哦"
      })
      return
    }

    const role = event.parameter
    if (!role) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "权限不能为空"
      })
      return
    }

    const mentionedUsers = await map(
      event.mentionUserIds,
      async (userId) =>
        await this.getUser(userId, event.originalEvent.extra.guild_id)
    )

    mentionedUsers.forEach((user) => {
      this.revokeRole(user, role)
    })

    mentionedUsers.forEach((user) => {
      ConfigUtils.updateGuildConfig(
        event.originalEvent.extra.guild_id,
        (config) => {
          if (config && config.users) {
            const userConfig = config.users[user.metadata.id]
            if (userConfig) {
              userConfig.roles = user.roles
            }
          }
          return config
        }
      )
    })

    const displayNames = mentionedUsers.map((user) =>
      displayNameFromUser(user.metadata)
    )

    this.respondToUser({
      originalEvent: event.originalEvent,
      content: `太惨了，你已从 ${
        displayNames.length
      } 位用户 (${displayNames.join(", ")}) 的手中收回了 ${role} 权限。`
    })
  }

  async handleSwitchUsingNamespaceMiku(event: ParseEventResultValid) {
    const guildId = event.originalEvent.extra.guild_id
    const channelId = event.originalEvent.target_id

    if (event.parameter === "on") {
      this.setAllowOmittingMentioningMe(guildId, channelId, true)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "好！后续指令无需再@我即可执行！"
      })
    } else if (event.parameter === "off") {
      this.setAllowOmittingMentioningMe(guildId, channelId, false)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "disabled `allowOmittingMentioningMe`"
      })
    } else {
      this.setAllowOmittingMentioningMe(guildId, channelId, false)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "参数不合法，应该输入 on 或者 off"
      })
    }
  }

  async handleQuery(event: ParseEventResultValid) {
    const mayBeTargetUserId = event.parameter
    if (
      !mayBeTargetUserId &&
      event.mentionUserIds.length === 0 &&
      event.mentionRoleIds.length > 0
    ) {
      // 用户常见的错误，@到role而非具体用户
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "你应该@具体用户，而不是@某个服务器角色，注意区分哦"
      })
      return
    }

    const userIds = event.mentionUserIds
    if (userIds.length !== 1 && !mayBeTargetUserId) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "能且只能同时查询 1 位用户的信息！"
      })
      return
    }

    const user = await this.getUser(
      mayBeTargetUserId ?? userIds[0],
      event.originalEvent.extra.guild_id
    )

    const displayName = displayNameFromUser(user.metadata)
    const list = [
      "名字: " + displayName,
      "昵称: " + user.metadata.nickname,
      "权限: " + user.roles.join(", "),
      "Bot: " + (user.metadata.bot ? "是" : "不是"),
      "BUFF 会员: " + (user.metadata.is_vip ? "是" : "不是"),
      "系统账号: " + (user.metadata.is_sys ? "是" : "不是"),
      "在线状态: " + (user.metadata.online ? "在线" : "离线"),
      "封禁状态: " + (user.metadata.status === 10 ? "封禁中" : "无"),
      "手机验证: " + (user.metadata.mobile_verified ? "已验证" : "未验证")
    ]
    this.respondToUser({
      originalEvent: event.originalEvent,
      content: list.join("\n")
    })
  }

  async handlePrintContext(event: ParseEventResultValid) {
    if (!this.contextManager) {
      return
    }
    const mixedContext = this.contextManager.getMixedContext(
      event.originalEvent.extra.guild_id,
      event.originalEvent.target_id,
      true
    )

    if (mixedContext.length === 0) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "当前频道的对话上下文为空~"
      })
      return
    }

    this.respondToUser({
      originalEvent: event.originalEvent,
      content: mixedContext
        .map(
          (unit) =>
            `${unit.name} (id=${unit.id})说：${
              unit.content.slice(0, 16) + "..."
            }`
        )
        .join("\n\n")
    })
  }

  async handleHelp(event: ParseEventResultValid) {
    const directives = prepareBuiltinDirectives(this)
    const content = directives
      .map((directive) =>
        [
          "指令: " + directive.triggerWord,
          "用法: " +
            `@我 /${directive.triggerWord} ${directive.parameterDescription}`,
          "用途: " + directive.description,
          "权限: " + directive.permissionGroups.join(", ")
        ].join("\n")
      )
      .join("\n==========\n")
    this.respondToUser({
      originalEvent: event.originalEvent,
      content: content
    })
  }

  async handleEvalUserInput(event: ParseEventResultValid) {
    if (!event.parameter) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "eval 内容不可为空~"
      })
      return
    }

    console.log(event.parameter)
    const parameters = event.parameter.split(" ")
    if (parameters.length < 3) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "参数解析失败~"
      })
      return
    }

    const method = parameters[0]
    const endpoint = parameters[1]
    const args = parameters
      .slice(2)
      .join(" ")
      .replace(/\\\\\"/g, '\\"')
    let parsed: unknown

    try {
      parsed = JSON.parse(args)
    } catch {
      error("Failed to parse JSON", args)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "eval 内容解析失败~"
      })
      return
    }
    const result = await Requests.request(
      endpoint,
      method as RequestMethod,
      parsed as any
    )

    this.respondToUser({
      originalEvent: event.originalEvent,
      content: JSON.stringify(result)
    })
  }

  async handleSwitchAIBackend(event: ParseEventResultValid) {
    const backend = event.parameter
    const channelConfig = ConfigUtils.getChannelConfig(
      event.originalEvent.extra.guild_id,
      event.originalEvent.target_id
    )
    if (
      [
        ChatBotBackend.GPT4,
        ChatBotBackend.GPT4o,
        ChatBotBackend.GPT4Turbo,
        ChatBotBackend.O1,
        ChatBotBackend.O1Mini,
        ChatBotBackend.O3Mini
      ].includes(backend as ChatBotBackend)
    ) {
      ConfigUtils.updateChannelConfig(
        event.originalEvent.extra.guild_id,
        event.originalEvent.target_id,
        (config) => {
          return {
            ...config,
            backend: backend as ChatBotBackend
          }
        }
      )
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: `已切换至 ChatGPT (${backend})`
      })
    } else if (backend?.startsWith("deepseek")) {
      ConfigUtils.updateChannelConfig(
        event.originalEvent.extra.guild_id,
        event.originalEvent.target_id,
        (config) => {
          return {
            ...config,
            backend: backend as ChatBotBackend
          }
        }
      )
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: `已切换至 DeepSeek (${backend})`
      })
    } else if (backend === ChatBotBackend.Ernie) {
      ConfigUtils.updateChannelConfig(
        event.originalEvent.extra.guild_id,
        event.originalEvent.target_id,
        (config) => {
          return {
            ...config,
            backend: backend as ChatBotBackend
          }
        }
      )
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "已切换至文心一言 (ERNIE-4.0-Turbo-8K)"
      })
    } else {
      const channelName = event.originalEvent.extra.channel_name
      const channelId = event.originalEvent.target_id
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: `当前频道: ${channelName} (${channelId}) 所用的模型是 ${
          channelConfig.backend ?? ChatBotBackend.GPT4o
        }，可选: ${Object.values(ChatBotBackend).join(", ")}`
      })
    }
  }

  async handleSetContext(event: ParseEventResultValid) {
    if (!event.parameter) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "context 不能为空~"
      })
      return
    }

    info("received user-defined context", event.parameter)

    if (event.parameter.startsWith("[http")) {
      event.parameter = event.parameter.slice(1, event.parameter.indexOf("]"))
    }

    if (event.parameter.startsWith("http")) {
      try {
        event.parameter = await (await fetch(event.parameter)).text()

        if (!event.parameter) {
          this.respondToUser({
            originalEvent: event.originalEvent,
            content: "context 内容为空~"
          })
          return
        }
      } catch {
        this.respondToUser({
          originalEvent: event.originalEvent,
          content: "context 下载失败~"
        })
        return
      }
    }

    try {
      const decoded = Buffer.from(event.parameter, "base64").toString("utf-8")
      const context = JSON.parse(decoded) as ContextUnit[]
      this.contextManager?.setContext(
        event.originalEvent.extra.guild_id,
        event.originalEvent.target_id,
        event.userProperties.metadata.id,
        context
      )
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: `已设置对话上下文，共 ${context.length} 条对话`
      })
      this.handlePrintContext(event)
    } catch (e) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "context 解析失败~"
      })
    }
  }

  async handleObliviate(event: ParseEventResultValid) {
    const guildId = event.originalEvent.extra.guild_id
    const channelId = event.originalEvent.target_id
    this.respondCardMessageToUser({
      originalEvent: event.originalEvent,
      content: CardBuilder.fromTemplate()
        .addIconWithKMarkdownText(
          CardIcons.MikuCute,
          `已遗忘当前服务器的当前频道对应的上下文`
        )
        .build()
    })
    this.contextManager?.removeContext(guildId, channelId)
  }

  async handleWhitelistGuild(event: ParseEventResultValid) {
    const [guildId, nickname] = (event.parameter ?? "").split(" ")
    if (!guildId || !nickname) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "guild-id 和 nickname 不能为空~"
      })
      return
    }

    ConfigUtils.updateGlobalConfig((config) => {
      config.whiteListedGuildIds ??= {}
      config.whiteListedGuildIds[guildId] = nickname
      return config
    })
    this.respondToUser({
      originalEvent: event.originalEvent,
      content: `已将 ${guildId} 加入白名单`
    })
  }

  async handleUnwhitelistGuild(event: ParseEventResultValid) {
    const guildId = event.parameter
    if (!guildId) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "guild id 不能为空~"
      })
      return
    }
    ConfigUtils.updateGlobalConfig((config) => {
      config.whiteListedGuildIds ??= {}
      delete config.whiteListedGuildIds[guildId]
      return config
    })
    this.respondToUser({
      originalEvent: event.originalEvent,
      content: `已将 ${guildId} 移出白名单`
    })
  }

  async handleSubcommand(event: ParseEventResultValid) {
    return yukiSubCommandHandler(this, event)
  }

  async showWhitelist(event: ParseEventResultValid) {
    const guilds = ConfigUtils.getGlobalConfig().whiteListedGuildIds ?? {}
    this.respondToUser({
      originalEvent: event.originalEvent,
      content: `白名单服务器: ${Object.entries(guilds)
        .map((k, v) => `${k}: ${v}`)
        .join(", ")}`
    })
  }

  setGroupChatStrategy(
    guildId: string,
    channelId: string,
    strategy: GroupChatStrategy
  ) {
    ConfigUtils.updateChannelConfig(guildId, channelId, (config) => {
      return {
        ...config,
        groupChatStrategy: strategy
      }
    })
  }

  setAllowOmittingMentioningMe(
    guildId: string,
    channelId: string,
    enabled: boolean
  ) {
    ConfigUtils.updateChannelConfig(guildId, channelId, (config) => {
      return {
        ...config,
        allowOmittingMentioningMe: enabled
      }
    })
  }

  getChatBotBackend(guildId: string, channelId: string): ChatBotBackend {
    return (
      ConfigUtils.getChannelConfig(guildId, channelId).backend ??
      ChatBotBackend.GPT4o
    )
  }

  getGroupChatStrategy(guildId: string, channelId: string): GroupChatStrategy {
    return (
      ConfigUtils.getChannelConfig(guildId, channelId).groupChatStrategy ??
      GroupChatStrategy.Normal
    )
  }

  isAllowOmittingMentioningMeEnabled(guildId: string, channelId: string) {
    return ConfigUtils.getChannelConfig(guildId, channelId)
      .allowOmittingMentioningMe
  }

  setContextManager(contextManager: ContextManager) {
    this.contextManager = contextManager
  }

  tryInitializeForUser(guildId: string, user: KUser) {
    if (!this.guildIdToUserIdToProperties.has(guildId)) {
      this.guildIdToUserIdToProperties.set(guildId, new Map())
    }
    const userIdToProperties = this.guildIdToUserIdToProperties.get(guildId)!

    if (!userIdToProperties.has(user.id)) {
      userIdToProperties.set(user.id, {
        metadata: user,
        roles: ConfigUtils.getGuildConfig(guildId).users?.[user.id]?.roles ?? []
      })
    }
  }

  async getUser(userId: string, guildId: string): Promise<UserProperties> {
    const userIdToProperties = this.guildIdToUserIdToProperties.get(guildId)
    if (userIdToProperties?.has(userId)) {
      return userIdToProperties.get(userId)!
    }

    const result = await Requests.queryUser({
      guild_id: guildId,
      user_id: userId
    })
    if (!result.success) {
      throw new Error(`User request failed: ${result.message}`)
    }

    this.tryInitializeForUser(guildId, result.data)
    return {
      roles: ConfigUtils.getGuildConfig(guildId).users?.[userId]?.roles ?? [],
      metadata: result.data
    }
  }

  assignRole(user: UserProperties, role: string) {
    if (user.roles.includes(role)) {
      return
    }
    user.roles.push(role)
  }

  revokeRole(user: UserProperties, role: string) {
    const roles = user.roles
    if (!roles.includes(role)) {
      return
    }
    user.roles = roles.filter((r) => r !== role)
  }

  /**
   * 每条 Directive 消息形如下列之一：
   * - `@ChatBot /directive`
   * - `@ChatBot /directive @user`
   * - `@ChatBot /directive <parameter>`
   * - `@ChatBot /directive <parameter> @user`
   *
   * 不以 / 开头的消息，不是 Directives
   */
  async tryParseEvent(
    extractedContent: string,
    event: KEvent<KTextChannelExtra>
  ): Promise<ParseEventResult> {
    if (!extractedContent.startsWith("/")) {
      return { shouldIntercept: false }
    }

    // Skip slash
    const [directive, ...parameter] = extractedContent
      .slice(1)
      .split(" ")
      .filter((part) => part.trim() !== "")

    if (directive === "") {
      return { shouldIntercept: false }
    }

    const user = await this.getUser(event.author_id, event.extra.guild_id)

    return {
      shouldIntercept: true,
      directive: directive,
      parameter: parameter.join(" "),
      mentionRoleIds: event.extra.mention_roles,
      mentionUserIds: event.extra.mention,
      originalEvent: event,
      userProperties: user
    }
  }

  dispatchDirectives(parsedEvent: ParseEventResultValid): boolean {
    const { directive } = parsedEvent
    const builtinDirectives = prepareBuiltinDirectives(this)
    const directiveItem = builtinDirectives.find(
      (d) => d.triggerWord === directive
    )
    if (!directiveItem) {
      warn("Match failed", directiveItem, directive)
      return false
    }
    if (!directiveItem.permissionGroups.includes("everyone")) {
      if (!isTrustedUser(parsedEvent.userProperties.metadata.id)) {
        if (
          !parsedEvent.userProperties.roles.some((r) =>
            directiveItem.permissionGroups.includes(r)
          )
        ) {
          this.respondToUser({
            originalEvent: parsedEvent.originalEvent,
            content: "权限不足，无法完成操作"
          })
          return true
        }
      }
    }
    directiveItem.handler(parsedEvent)
    return true
  }
}

function prepareBuiltinDirectives(
  manager: ChatDirectivesManager
): ChatDirectiveItem[] {
  return [
    {
      triggerWord: "groupchat",
      parameterDescription: "normal|legacy|off",
      description:
        "群聊模式。启用后，在当前频道下，各人与机器人的对话将不再隔离。机器人能够分辨哪句话是谁说的。",
      defaultValue: "normal",
      permissionGroups: ["admin"],
      handler: manager.handleGroupChat.bind(manager)
    },
    {
      triggerWord: "assign",
      parameterDescription: "<role> @user",
      description: "添加 <role> 角色给@的人",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleAssignRole.bind(manager)
    },
    {
      triggerWord: "revoke",
      parameterDescription: "<role> @user",
      description: "移除@的人的 <role> 角色",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleRevokeRole.bind(manager)
    },
    {
      triggerWord: "using_namespace_miku",
      parameterDescription: "on|off",
      description: '是否允许省略"@我"而直接使用指令',
      defaultValue: undefined,
      permissionGroups: ["everyone"],
      handler: manager.handleSwitchUsingNamespaceMiku.bind(manager)
    },
    {
      triggerWord: "query",
      parameterDescription: "@user",
      description: "查询@的人的基本信息",
      defaultValue: undefined,
      permissionGroups: ["everyone"],
      handler: manager.handleQuery.bind(manager)
    },
    {
      triggerWord: "print_context",
      parameterDescription: "",
      description: "(调试限定) 输出当前频道的对话上下文",
      defaultValue: undefined,
      permissionGroups: ["developer"],
      handler: manager.handlePrintContext.bind(manager)
    },
    {
      triggerWord: "help",
      parameterDescription: "",
      description: "查看帮助",
      defaultValue: undefined,
      permissionGroups: ["everyone"],
      handler: manager.handleHelp.bind(manager)
    },
    {
      triggerWord: "eval",
      parameterDescription: "<method> <endpoint> <...data>",
      description: "使用你给定的 JSON 数据，以我的名义调用接口，十分很危险",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleEvalUserInput.bind(manager)
    },
    {
      triggerWord: "set_backend",
      parameterDescription: Object.values(ChatBotBackend).join("|"),
      description: `更换当前频道 AI 实现，可选范围：${Object.values(
        ChatBotBackend
      ).join(", ")}`,
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleSwitchAIBackend.bind(manager)
    },
    {
      triggerWord: "set_context",
      parameterDescription: "<context>",
      description: "设置当前频道的对话上下文",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleSetContext.bind(manager)
    },
    {
      triggerWord: "obliviate",
      parameterDescription: "",
      description: "遗忘当前服务器的当前频道对应的上下文",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleObliviate.bind(manager)
    },
    {
      triggerWord: "whitelist",
      parameterDescription: "<guild-id> <nickname>",
      description: "将指定服务器加入白名单",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleWhitelistGuild.bind(manager)
    },
    {
      triggerWord: "unwhitelist",
      parameterDescription: "<guild-id>",
      description: "将指定服务器移出白名单",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleUnwhitelistGuild.bind(manager)
    },
    {
      triggerWord: "show_whitelist",
      parameterDescription: "",
      description: "查看白名单服务器",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.showWhitelist.bind(manager)
    },
    {
      triggerWord: "yuki",
      parameterDescription: "",
      description: "Yuki Subcommands",
      defaultValue: undefined,
      permissionGroups: ["everyone"],
      handler: manager.handleSubcommand.bind(manager)
    }
  ]
}

export type ParseEventResult =
  | ParseEventResultDontIntercept
  | ParseEventResultValid

export interface ParseEventResultDontIntercept {
  shouldIntercept: false
}

export interface ParseEventResultValid {
  shouldIntercept: true
  directive: string
  parameter: string | undefined
  mentionRoleIds: number[]
  mentionUserIds: string[]
  originalEvent: KEvent<KTextChannelExtra>
  userProperties: UserProperties
}

export interface UserProperties {
  roles: string[]
  metadata: KUser
}

export interface ChatDirectiveHandler {
  (parsedEvent: ParseEventResultValid): void
}

export interface ChatDirectiveItem {
  triggerWord: string
  parameterDescription: string
  description: string
  defaultValue: string | undefined
  permissionGroups: string[]
  handler: ChatDirectiveHandler
}
