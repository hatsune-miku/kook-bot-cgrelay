import { KUser } from "./websocket/kwebsocket/types"

export function displayNameFromUser(user: KUser) {
  return `${user.username}#${user.identify_num}`
}

export function isTrustedUser(userId: string) {
  // TODO 哈哈哈哈哈哈
  return ["3576061439", "3553226959"].includes(userId)
}
