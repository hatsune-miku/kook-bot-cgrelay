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
  const labels = ["rol", "met"]
  let content = event.content

  // Remove KMarkdown labels
  for (const label of labels) {
    const regex = new RegExp(`\\(${label}\\).+?\\(${label}\\)`, "g")
    content = content.replace(regex, "")
  }

  // Replace escaped characters
  const replacements: [RegExp, string][] = [
    [/\\\(/g, "("],
    [/\\\)/g, ")"],
    [/\\\[/g, "["],
    [/\\\]/g, "]"],
    [/\\\{/g, "{"],
    [/\\\}/g, "}"]
  ]

  for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement)
  }

  return content.trim()
}
