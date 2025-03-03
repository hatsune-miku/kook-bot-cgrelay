import { Express } from "express"

export function defineRoute(app: Express) {
  app.get("/kook/api/v1", (req, res) => {
    res.send(new Date().toISOString())
  })

  app.get("/kook/api/v1/download", (req, res) => {
    const fileName = (req.query.file as string) || ""
    if (!fileName) {
      res.status(400).send("file is required")
      return
    }

    const filePath = `/tmp/${fileName}`
    res.download(filePath, fileName, (err) => {
      if (err) {
        res.status(500).send(err.message)
      }
    })
  })
}
