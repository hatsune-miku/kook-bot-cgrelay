import { KUser } from "./websocket/kwebsocket/types";

export function displayNameFromUser(user: KUser) {
  return `${user.nickname}#${user.identify_num}`;
}
