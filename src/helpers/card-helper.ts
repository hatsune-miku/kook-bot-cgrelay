import { KCardMessage, KCardMessageElement, KCardSize } from "../events"

export class CardHelper {}

export interface CardBuilderTemplateOptions {
  initialCard?: Omit<KCardMessage[0], "modules">
}

export class CardBuilder {
  private card: KCardMessage = [
    {
      type: "card",
      theme: "secondary",
      size: "sm",
      modules: []
    }
  ]
  private main = this.card[0]
  private modules = this.card[0].modules

  private constructor(options: CardBuilderTemplateOptions) {
    if (options.initialCard) {
      this.card[0] = { ...this.card[0], ...options.initialCard }
    }
  }

  static fromTemplate(options: CardBuilderTemplateOptions = {}) {
    return new CardBuilder(options)
  }

  size(size: KCardSize) {
    this.main.size = size
    return this
  }

  theme(theme: KCardMessageElement["theme"]) {
    this.main.theme = theme
    return this
  }

  color(color: KCardMessageElement["color"]) {
    this.main.color = color
    return this
  }

  addIconWithText(iconUrl: string, text: string) {
    this.modules.push({
      type: "section",
      text: {
        type: "plain-text",
        content: text
      },
      mode: "left",
      accessory: {
        type: "image",
        src: iconUrl,
        size: "sm"
      }
    })
    return this
  }

  addPlainText(text: string) {
    this.modules.push({
      type: "section",
      text: {
        type: "plain-text",
        content: text
      }
    })
    return this
  }

  build() {
    return JSON.stringify(this.card)
  }
}
