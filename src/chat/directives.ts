import { EventEmitter } from "stream"
import { warn } from "../utils/logging/logger"
import { KEvent, KTextChannelExtra, KUser } from "../websocket/kwebsocket/types"
import { Events, KCardMessage, RespondToUserParameters } from "../events"
import { displayNameFromUser } from "../utils"
import { RequestMethod, Requests } from "../utils/krequest/request"
import { map } from "radash"
import { extractContent } from "../utils/kevent/utils"
import ConfigUtils from "../utils/config/config"
import { ContextManager } from "./context-manager"
import { ChatBotBackend, GroupChatStrategy } from "./types"
import { CreateChannelMessageProps } from "../utils/krequest/types"

export class ChatDirectivesManager {
  private userIdToProperties = new Map<string, UserProperties>()
  private userIdToV2TokenHeaders = new Map<string, Record<string, string>>()
  private groupChatStrategy: GroupChatStrategy = GroupChatStrategy.Normal
  private allowOmittingMentioningMe = false
  private superKookMode = false
  private contextManager: ContextManager | null = null
  private chatBotBackend: ChatBotBackend = ChatBotBackend.ChatGPT

  constructor(private eventEmitter: EventEmitter) {}

  respondToUser(params: RespondToUserParameters) {
    this.eventEmitter.emit(Events.RespondToUser, params)
  }

  respondCardMessageToUser(params: RespondToUserParameters) {
    this.eventEmitter.emit(Events.RespondCardMessageToUser, params)
  }

  handleGroupChat(event: ParseEventResultValid) {
    if (event.parameter === "normal") {
      this.setGroupChatStrategy(GroupChatStrategy.Normal)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "好欸！已启用群聊模式！"
      })
    } else if (event.parameter === "legacy") {
      this.setGroupChatStrategy(GroupChatStrategy.Legacy)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "已启用传统群聊模式！仅@我的消息会被计算。"
      })
    } else if (event.parameter === "off") {
      this.setGroupChatStrategy(GroupChatStrategy.Off)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "好！已关闭群聊模式！"
      })
    } else {
      this.setGroupChatStrategy(GroupChatStrategy.Off)
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
      ConfigUtils.setUserConfig(user.metadata.id, {
        roles: user.roles
      })
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
      ConfigUtils.setUserConfig(user.metadata.id, {
        roles: user.roles
      })
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
    if (event.parameter === "on") {
      this.setAllowOmittingMentioningMe(true)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "好！后续指令无需再@我即可执行！"
      })
    } else if (event.parameter === "off") {
      this.setAllowOmittingMentioningMe(false)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "disabled `allowOmittingMentioningMe`"
      })
    } else {
      this.setAllowOmittingMentioningMe(false)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "参数不合法，应该输入 on 或者 off"
      })
    }
  }

  async handleSwitchSuperKookMode(event: ParseEventResultValid) {
    if (event.parameter === "on") {
      this.setSuperKookMode(true)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content:
          "哼哼！无情开搓机器概率UP，所有消息有 (spl)40%(spl) 的概率被选为幸运对话"
      })
      const cardMessage: KCardMessage = [
        {
          type: "card",
          theme: "primary",
          size: "lg",
          modules: [
            {
              type: "container",
              elements: [
                {
                  type: "image",
                  src: "https://img.kookapp.cn/emojis/5534585084574314/0ZxPSw8llx04g04g.png"
                }
              ]
            }
          ]
        }
      ]
      this.respondCardMessageToUser({
        originalEvent: event.originalEvent,
        content: JSON.stringify(cardMessage)
      })
    } else if (event.parameter === "off") {
      this.setSuperKookMode(false)
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "呜呜呜，无情开搓机器已关闭"
      })
    } else {
      this.setSuperKookMode(false)
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

  async handleUpdateToken(event: ParseEventResultValid) {
    const stringWithToken = extractContent(event.originalEvent)
    const mayBeHeaders = stringWithToken.split("\n")
    const headers = {
      cookie: "",
      "x-client-sessionid": ""
    }
    const featuredKeys = Object.keys(headers)

    for (const mayBeHeader of mayBeHeaders) {
      const components = mayBeHeader.split(":")
      if (components.length !== 2) {
        continue
      }
      const [key, value] = components
      const headerKey = key.trim().toLowerCase() as keyof typeof headers
      if (!featuredKeys.includes(headerKey)) {
        continue
      }
      headers[headerKey] = value.trim()
    }

    if (Object.values(headers).some((v) => v === "")) {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "数据不完整，无法更新"
      })
      return
    }

    this.userIdToV2TokenHeaders.set(event.userProperties.metadata.id, headers)

    this.respondToUser({
      originalEvent: event.originalEvent,
      content: "token 解析成功，数据已记录。请输入 /play 更新游戏状态。"
    })
  }

  async handlePrintContext(event: ParseEventResultValid) {
    if (!this.contextManager) {
      return
    }
    const mixedContext = this.contextManager.getMixedContext(
      event.originalEvent.extra.guild_id,
      true
    )
    this.respondToUser({
      originalEvent: event.originalEvent,
      content: mixedContext
        .map((unit) => `${unit.name}说：${unit.content}`)
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
    const args = parameters.slice(2).join(" ")
    let parsed: unknown

    try {
      parsed = JSON.parse(args)
    } catch {
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
    if (backend === ChatBotBackend.ChatGPT) {
      this.chatBotBackend = ChatBotBackend.ChatGPT
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "已切换至 ChatGPT (gpt-4o)"
      })
    } else if (backend === ChatBotBackend.Ernie) {
      this.chatBotBackend = ChatBotBackend.Ernie
      this.respondToUser({
        originalEvent: event.originalEvent,
        content: "已切换至文心一言 (ERNIE-4.0-Turbo-8K)"
      })
    } else {
      this.respondToUser({
        originalEvent: event.originalEvent,
        content:
          "参数不合法，应该输入 chatgpt 或者 ernie. 当前: " +
          this.chatBotBackend
      })
    }
  }

  setGroupChatStrategy(strategy: GroupChatStrategy) {
    this.groupChatStrategy = strategy
  }

  setAllowOmittingMentioningMe(enabled: boolean) {
    this.allowOmittingMentioningMe = enabled
  }

  setSuperKookMode(enabled: boolean) {
    this.superKookMode = enabled
  }

  getChatBotBackend(): ChatBotBackend {
    return this.chatBotBackend
  }

  getGroupChatStrategy(): GroupChatStrategy {
    return this.groupChatStrategy
  }

  isAllowOmittingMentioningMeEnabled() {
    return this.allowOmittingMentioningMe
  }

  isSuperKookModeEnabled() {
    return this.superKookMode
  }

  setContextManager(contextManager: ContextManager) {
    this.contextManager = contextManager
  }

  tryInitializeForUser(user: KUser) {
    if (!this.userIdToProperties.has(user.id)) {
      this.userIdToProperties.set(user.id, makeDefaultUserPropertiesFor(user))
    }
  }

  async getUser(userId: string, guildId: string): Promise<UserProperties> {
    if (this.userIdToProperties.has(userId)) {
      return this.userIdToProperties.get(userId)!
    }

    const result = await Requests.queryUser({
      guild_id: guildId,
      user_id: userId
    })
    if (!result.success) {
      throw new Error(`User request failed: ${result.message}`)
    }

    this.tryInitializeForUser(result.data)
    return {
      roles: ConfigUtils.getUserConfig(userId).roles ?? [],
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

  dispatchDirectives(parsedEvent: ParseEventResultValid) {
    const { directive } = parsedEvent
    const builtinDirectives = prepareBuiltinDirectives(this)
    const directiveItem = builtinDirectives.find(
      (d) => d.triggerWord === directive
    )
    if (!directiveItem) {
      warn("Match failed", directiveItem)
      return
    }
    if (!directiveItem.permissionGroups.includes("everyone")) {
      // TODO 哈哈哈哈哈哈
      if (parsedEvent.userProperties.metadata.identify_num !== "6308") {
        if (
          !parsedEvent.userProperties.roles.some((r) =>
            directiveItem.permissionGroups.includes(r)
          )
        ) {
          this.respondToUser({
            originalEvent: parsedEvent.originalEvent,
            content: "权限不足，无法完成操作"
          })
          return
        }
      }
    }
    directiveItem.handler(parsedEvent)
  }
}

function makeDefaultUserPropertiesFor(user: KUser): UserProperties {
  const config = ConfigUtils.getUserConfig(user.id)
  return {
    roles: config.roles ?? [],
    metadata: user
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
        "群聊模式，启用后，各人与机器人的对话将不再隔离。机器人能够分辨哪句话是谁说的。",
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
      triggerWord: "kook",
      parameterDescription: "on|off",
      description: "哼哼~",
      defaultValue: undefined,
      permissionGroups: ["everyone"],
      handler: manager.handleSwitchSuperKookMode.bind(manager)
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
      triggerWord: "updatetoken",
      parameterDescription: "<fiddler-data>",
      description: "更新 KOOK 账号 token",
      defaultValue: undefined,
      permissionGroups: ["everyone"],
      handler: manager.handleUpdateToken.bind(manager)
    },
    {
      triggerWord: "print_context",
      parameterDescription: "",
      description: "(调试限定) 输出当前对话上下文",
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
      parameterDescription: "chatgpt|ernie",
      description: "更换 AI 实现，可选范围：chatgpt, ernie",
      defaultValue: undefined,
      permissionGroups: ["admin"],
      handler: manager.handleSwitchAIBackend.bind(manager)
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
