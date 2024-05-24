/*
 * @Path          : \kook-bot-cgrelay\src\chat\cgrelay.ts
 * @Created At    : 2024-05-22 17:01:43
 * @Last Modified : 2024-05-24 19:26:16
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import fetch from "node-fetch"

const EventSourceAlt = require('eventsource')

const AuthString = "Bearer DHdvnQwGA0Gti3SI70OHr7+EBXmzpdjQm+8MMheGCVMKCX3tQP0utmAuXeovv/XQnHyPTP1mD466WwHdo0FmPtGhe9bqDG+t4VyVU/1xyM46Guo7BZorCNm+WS2781aT5ATdUiKbDGbt2oRvBu2BGTNCyQDL+VVT9W+06s9lO2bLOgtVcNPfPEuvY5recu+jEaO+dUrt3rr+8eQTRR+2RmFTsjLXuf7X6Fs40oga8RkrzfYWdAUztKwPQ2b+XbleJCBUG/78MDawFmx0UxdWnPrtorj9/j/1z54qIdbn2nXZnT61BYZKOlTIRN3y/uf116R/PsEUrb65gxJmDkWV6Lh4IBfOxXS6eVvC7V2DFnT65rQFSQus/ym+PU7kVzBTBeas0+IQqY+wBgIpZ0zEF7QZXKdbu8MfRAlI+JQLKRnorI6B+LNEOq+oaRyT24BjMjMj4DOkqEPVXex6JJHCxl3bz+7+/bWZxlrHVMarwlt/XNKfaB4OEhQUQC5EPouLdB8icP1J0aU6CszVNksIXs2ZpVXZu/qNKZ/AcdgVbEGXY7icI6dpU1a/EUTt1x/68i+ahyYbJEX19GjAXnux9o0C0sbFaK0ZHyJ8kgJfF/waGk1OrmGJ80c9c3E5euvtQDATMo8Fv2h6r/TTT99KkopKchYGUMYQtjOQC8tPRwNz/bYY+rjIp1ciyblTqklVRGJfvM3fTM1e0/BAQs0rfze2gVccCPPWAxVH/s8WCOEH4m2YwPmTG9U95xAbqvCbJTsqoJs4wVECu7L+Mkl4MCI6lwCTA1wYzQzWG2J2lg6aAt0g2CqWM1moGK2xhtR3CjFD5u7nn5f/lhK+YA9DDxesIs/i+myEJbebSDfpfYYswu/13GnBXjVf9XFyPZc0bG7zO9xlt66SiGFm98xeJe+QZGcqxoXW11tfiVLNxdU4zvI1GrqXnWAAE1BLSb9w1A8qdeLn1hH/+VIw/5Tv1/3a98sMFJMY1H3DHcFpqzj+TTZqNKWqi7rPlUiUhFUhKVRToIFp2/7DC/x6m8nYN1VQoKec/DMFVbEVu+eMZ0t91NYty6AKJafB8G5q28oPzTtGrSmkh2cq8610UI0XBd7S7PR7oNaAjXEMzeuIK6HN8lgpN/MD8z41qf8PT61CQPiLbZYPGxzEOWSJZa+MFQ=="

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
