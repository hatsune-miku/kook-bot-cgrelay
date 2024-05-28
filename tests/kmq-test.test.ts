import { KMessageQueue } from "../src/utils/pqueue/kmqueue"

test("KMessageQueue works", () => {
    const q = new KMessageQueue<string>()

    q.enqueue("a", 1)
    q.enqueue("b", 2)
    q.enqueue("c", 3)
    q.enqueue("d", 4)
    q.enqueue("e", 5)
    q.enqueue("f", -114514)
    expect(q.isPriorityStrictAscending()).toBe(false)
    q.dequeue()
    expect(q.isPriorityStrictAscending()).toBe(true)
    q.enqueue("g", 6)
    q.enqueue("h", 7)
    expect(q.isPriorityStrictAscending()).toBe(true)
    q.dequeue()
    expect(q.isPriorityStrictAscending()).toBe(true)
    q.enqueue("jumped", 9)
    expect(q.isPriorityStrictAscending()).toBe(false)
    q.enqueue("i", 8)
    expect(q.isPriorityStrictAscending()).toBe(true)
})
