import { KUser } from "./websocket/kwebsocket/types"

export function displayNameFromUser(user: KUser) {
  return `${user.username}#${user.identify_num}`
}
