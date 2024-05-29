import { EventEmitter } from "stream"
import { warn } from "../utils/logging/logger"
import { KEvent, KTextChannelExtra, KUser } from "../websocket/kwebsocket/types"
import { Events, RespondToUserParameters } from "../events"
import e from "express"
import { displayNameFromUser } from "../utils"
import { Requests } from "../utils/krequest/request"
import { map } from "radash"

export class ChatDirectivesManager {
    private userIdToProperties = new Map<string, UserProperties>()
    private groupChat = false

    constructor(private eventEmitter: EventEmitter) {

    }

    respondToUser(params: RespondToUserParameters) {
        this.eventEmitter.emit(Events.RespondToUser, params)
    }

    handleGroupChat(event: ParseEventResultValid) {
        if (event.parameter === 'on') {
            this.setGroupChat(true)
            this.respondToUser({
                originalEvent: event.originalEvent,
                content: "好！已启用群聊模式！",
            })
        }
        else if (event.parameter === 'off') {
            this.setGroupChat(false)
            this.respondToUser({
                originalEvent: event.originalEvent,
                content: "好！已关闭群聊模式！",
            })
        }
        else {
            this.setGroupChat(false)
            this.respondToUser({
                originalEvent: event.originalEvent,
                content: "参数不合法，应该输入 on 或者 off",
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
                content: '权限不能为空'
            })
            return
        }

        const mentionedUsers = await map(
            event.mentionUserIds,
            async (userId) => await this.getUser(userId, event.originalEvent.extra.guild_id)
        )

        mentionedUsers.forEach(user => {
            this.assignRole(user, role)
        })

        const displayNames = mentionedUsers.map(user => displayNameFromUser(user.metadata))
        this.respondToUser({
            originalEvent: event.originalEvent,
            content: `好耶！已将 ${role} 授予 ${displayNames.length} 位用户: ${displayNames.join(', ')}`
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
                content: '权限不能为空'
            })
            return
        }

        const mentionedUsers = await map(
            event.mentionUserIds,
            async (userId) => await this.getUser(userId, event.originalEvent.extra.guild_id)
        )

        mentionedUsers.forEach(user => {
            this.revokeRole(user, role)
        })

        const displayNames = mentionedUsers.map(user => displayNameFromUser(user.metadata))

        this.respondToUser({
            originalEvent: event.originalEvent,
            content: `太惨了，你已从 ${displayNames.length} 位用户 (${displayNames.join(', ')}) 的手中收回了 ${role} 权限。`
        })
    }

    async handleQuery(event: ParseEventResultValid) {
        if (event.mentionUserIds.length === 0 && event.mentionRoleIds.length > 0) {
            // 用户常见的错误，@到role而非具体用户
            this.respondToUser({
                originalEvent: event.originalEvent,
                content: "你应该@具体用户，而不是@某个服务器角色，注意区分哦"
            })
            return
        }

        const userIds = event.mentionUserIds
        if (userIds.length !== 1) {
            this.respondToUser({
                originalEvent: event.originalEvent,
                content: "能且只能同时查询 1 位用户的信息！"
            })
            return
        }

        const user = await this.getUser(userIds[0], event.originalEvent.extra.guild_id)
        const displayName = displayNameFromUser(user.metadata)
        const list = [
            '名字: ' + displayName,
            '权限: ' + user.roles.join(', '),
            '是否为 Bot: ' + (user.metadata.bot ? '是' : '不是'),
            '在线状态: ' + (user.metadata.online ? '在线' : '离线'),
            '封禁状态: ' + (user.metadata.status === 10 ? '封禁中' : '无'),
            '手机验证: ' + (user.metadata.mobile_verified ? '已验证' : '未验证'),
        ]
        this.respondToUser({
            originalEvent: event.originalEvent,
            content: list.join('\n')
        })
    }

    async handleHelp(event: ParseEventResultValid) {
        const directives = prepareBuiltinDirectives(this)
        const content = directives.map(directive => [
            '指令: ' + directive.triggerWord,
            '用法: ' + `@我 /${directive.triggerWord} ${directive.parameterDescription}`,
            '用途: ' + directive.description,
            '权限: ' + directive.permissionGroups.join(', '),
        ].join('\n')).join('\n==========\n')
        this.respondToUser({
            originalEvent: event.originalEvent,
            content: content,
        })
    }

    setGroupChat(enabled: boolean) {
        this.groupChat = enabled
    }

    isGroupChatEnabled() {
        return this.groupChat
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
            user_id: userId,
        })
        if (!result.success) {
            throw new Error(`User request failed: ${result.message}`)
        }

        this.tryInitializeForUser(result.data)
        return {
            roles: [],
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
        user.roles = roles.filter(r => r !== role)
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
    async tryParseEvent(extractedContent: string, event: KEvent<KTextChannelExtra>): Promise<ParseEventResult> {
        if (!extractedContent.startsWith('/')) {
            return { shouldIntercept: false }
        }

        // Skip slash
        const [directive, parameter] = extractedContent.slice(1)
            .split(' ')
            .filter(part => part.trim() !== '')

        if (directive === '') {
            return { shouldIntercept: false }
        }

        const user = await this.getUser(event.author_id, event.extra.guild_id)

        return {
            shouldIntercept: true,
            directive: directive,
            parameter: parameter,
            mentionRoleIds: event.extra.mention_roles,
            mentionUserIds: event.extra.mention,
            originalEvent: event,
            userProperties: user,
        }
    }

    dispatchDirectives(parsedEvent: ParseEventResultValid) {
        const { directive } = parsedEvent
        const builtinDirectives = prepareBuiltinDirectives(this)
        const directiveItem = builtinDirectives.find(d => d.triggerWord === directive)
        if (!directiveItem) {
            warn("Match failed", directiveItem)
            return
        }
        // TODO
        if (!directiveItem.permissionGroups.includes('everyone')) {
            if (parsedEvent.userProperties.metadata.identify_num !== '6308') {
                if (!parsedEvent.userProperties.roles.some(r => directiveItem.permissionGroups.includes(r))) {
                    this.respondToUser({
                        originalEvent: parsedEvent.originalEvent,
                        content: '权限不足，无法完成操作'
                    })
                    return
                }
            }
        }
        directiveItem.handler(parsedEvent)
    }
}

function makeDefaultUserPropertiesFor(user: KUser): UserProperties {
    return {
        roles: [],
        metadata: user,
    }
}

function prepareBuiltinDirectives(manager: ChatDirectivesManager): ChatDirectiveItem[] {
    return [
        {
            triggerWord: 'groupchat',
            parameterDescription: 'on|off',
            description: '群聊模式，启用后，各人与机器人的对话将不再隔离。机器人能够分辨哪句话是谁说的。',
            defaultValue: 'off',
            permissionGroups: ['admin'],
            handler: manager.handleGroupChat.bind(manager),
        },
        {
            triggerWord: 'assign',
            parameterDescription: '<role> @user',
            description: '添加 <role> 角色给@的人',
            defaultValue: undefined,
            permissionGroups: ['admin'],
            handler: manager.handleAssignRole.bind(manager),
        },
        {
            triggerWord: 'revoke',
            parameterDescription: '<role> @user',
            description: '移除@的人的 <role> 角色',
            defaultValue: undefined,
            permissionGroups: ['admin'],
            handler: manager.handleRevokeRole.bind(manager),
        },
        {
            triggerWord: 'query',
            parameterDescription: '@user',
            description: '查询@的人的基本信息',
            defaultValue: undefined,
            permissionGroups: ['everyone'],
            handler: manager.handleQuery.bind(manager),
        },
        {
            triggerWord: 'help',
            parameterDescription: '',
            description: '查看帮助',
            defaultValue: undefined,
            permissionGroups: ['everyone'],
            handler: manager.handleHelp.bind(manager),
        }
    ]
}

export type ParseEventResult = ParseEventResultDontIntercept | ParseEventResultValid

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