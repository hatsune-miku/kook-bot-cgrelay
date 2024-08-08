import { KEvent, KTextChannelExtra } from "../../websocket/kwebsocket/types"

export function isExplicitlyMentioningBot(
  event: KEvent<KTextChannelExtra>,
  botId: string,
  botRoles: number[]
) {
  try {
    return (
      event.extra.mention.includes(botId) ||
      event.extra.mention_roles.some((role) => botRoles.includes(role))
    )
  } catch {
    return false
  }
}

export function removingKMarkdownLabels(content: string, labels: string[]) {
  return labels
    .reduce((acc, label) => {
      const regex = new RegExp(String.raw`\(${label}\).+?\(${label}\)`, "g")
      return acc.replace(new RegExp(regex, "g"), "")
    }, content)
    .trim()
}

export function extractContent(event: KEvent<KTextChannelExtra>) {
  return removingKMarkdownLabels(event.content, ["rol", "met"])
    .replace(new RegExp(String.raw`\\\(`, "g"), "(")
    .replace(new RegExp(String.raw`\\\)`, "g"), ")")
    .replace(new RegExp(String.raw`\\\[`, "g"), "[")
    .replace(new RegExp(String.raw`\\\]`, "g"), "]")
    .replace(new RegExp(String.raw`\\\{`, "g"), "{")
    .replace(new RegExp(String.raw`\\\}`, "g"), "}")
}
