/*
 * @Path          : \kook-bot-cgrelay\src\chat\cgrelay.ts
 * @Created At    : 2024-05-22 17:01:43
 * @Last Modified : 2024-05-22 18:00:07
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import fetch from "node-fetch"

const EventSourceAlt = require('eventsource')

const AuthString = "Bearer DHdvnQwGA0Gti3SI70OHr7+EBXmzpdjQm+8MMheGCVMKCX3tQP0utmAuXeovv/XQnHyPTP1mD466WwHdo0FmPtGhe9bqDG+t4VyVU/1xyM46Guo7BZorCNm+WS2781aTAaYmbkG+jTohwRzrOS54PkvlcRPpAGR/bL+CeIy8uEy/Rc/JQTlRfFC1SiqbsUdkrEpKPhe8yS1C/aEGlhOFDQ1Y4pRCvKcXj4sq5xrzMfNpqIxF3x4DqPa/gJlQbB1HadSTt9qk0qoa7BElcQjxDbwFx0dbkbh4XtFnKUwE8vv9geCdfQ3aWU1OyqmTIij7HJP8eXBYgBl5m3/WY9vk8QU6wXpH6i1QiRUtfy00251/gWgtlQXPKH1xsfTU1o1DM6DEoRjIYe5CM4Hk/APw1sH0nNjr2xZ+lsZO6tIJo0vC6OfqB3YiH6yvQsKZooHeDnGNY7h9jo2LYBov1VGpre9YlzfB8OuJQfBOJD9kLNe3f23/3KkN+mc5C4dadtFjBubDkCOKX7iBQAdOtVtO4nkCUanB2aA6XHCa9+V3gE33BBlZzOw0DpfOjfDWm3d8O6I69U2kGtsiB7imVoYYY4VZ3fwygWgaW8rUhUtN2qWChl6wjYqDMLmTn2e2NX+gTwAZdcvnRtARIbbq7KjstNgaJow7czGQBePZJLDY2rxcNuwpRnBSI6x6znL3MGfwDljUX7oKihNBgSALNB4fYr2ulbxRpRQnM1tjHdKNiklDuCLYXOiQ93/wtGrmc7/I2YpuRKySDRxj+z5ygDR1QdSAPzXdHaStt69SUA2JGR3zP8UAe4LCD3uz7enqe1lToS/vJRyZDVf5JZ/UkG6KboLJjlhqw8jAdAq6Si/b13fWMLNcRBceEICxpqxmL9dht3e1SFIZJNzDZkAgMMMIU2NnBVbE9OiS/JiIVwsSG1vBJWPlQwML+466VmKSAnkL4J3iYQ6/cuT809NuKaZKAb0QtvzoYoncXYdplt62w+Lg9WEacqbi9Eg1e6JmobJR5iEwMUYH1zeogwmUmkunN7TdhPK2Rxxp/CPjw6Irzlf2cciT4x/Ks1GnS9W8oZjK7Fxr7n5LuNUvxppqgzknevCtEk+lNl6GD+t7FAxpM7PFPRB8MkxYW0wkn/4+QojHrctHGQf0xLRE5BqlMuayFg=="

export async function chatCompletionWithoutStream(prompt: string): Promise<string> {
    const messages = [
        { role: 'system', content: '你是ChatGPT，目前作为某即时通讯平台的一个Bot，为任何向你提问的用户提供简短的解答。' },
        { role: 'user', content: prompt },
    ]

    const response = await fetch("https://cg-api.eggtartc.com/api/v1/chat/stream", {
        "headers": {
            "accept": "*/*",
            "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
            "authorization": AuthString,
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Google Chrome\";v=\"125\", \"Chromium\";v=\"125\", \"Not.A/Brand\";v=\"24\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "Referer": "https://cg.eggtartc.com/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": JSON.stringify({
            context: messages,
            model: "gpt-3.5-turbo-16k"
        }),
        "method": "POST"
    })

    if (!response.ok) {
        return "<No response>"
    }

    const responseBody = await response.json()
    const subscribeUuid = responseBody.uuid

    const source = new EventSourceAlt(`https://cg-api.eggtartc.com/api/v1/chat/stream/${subscribeUuid}`, {
        headers: {
            'Authorization': AuthString,
        }
    })

    return receiveFromAndMergeEventSource(source)
}

async function receiveFromAndMergeEventSource(source: any): Promise<string> {
    const messages: string[] = []
    return new Promise((resolve, reject) => {
        source.addEventListener('message', (event: any) => {
            if (event.data === '[DONE]') {
                source.close()
                resolve(messages.join(''))
                return
            }
            try {
                const messagePart = JSON.parse(event.data)['choices'][0]['delta']['content']
                messages.push(messagePart)
            }
            catch {
                reject('Failed to parse message')
            }
        })
    })

}
