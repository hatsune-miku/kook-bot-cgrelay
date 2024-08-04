export class PriorityQueue<T> {
  protected heap: Item<T>[] = [];

  constructor() {}

  public enqueue(value: T, priority: number): void {
    const item = new Item(value, priority);
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  public dequeue(): [T, number] | undefined {
    if (this.isEmpty()) {
      return undefined;
    }

    this.swap(0, this.heap.length - 1);
    const item = this.heap.pop();
    this.bubbleDown(0);

    if (!item) {
      return undefined;
    }

    return [item.value, item.priority];
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public size(): number {
    return this.heap.length;
  }

  public clear() {
    this.heap = [];
  }

  private bubbleUp(index: number): void {
    const parentIndex = Math.floor((index - 1) / 2);

    if (
      index > 0 &&
      this.heap[index].priority < this.heap[parentIndex].priority
    ) {
      this.swap(index, parentIndex);
      this.bubbleUp(parentIndex);
    }
  }

  private bubbleDown(index: number): void {
    const leftChildIndex = 2 * index + 1;
    const rightChildIndex = 2 * index + 2;
    let smallestIndex = index;

    if (
      leftChildIndex < this.heap.length &&
      this.heap[leftChildIndex].priority < this.heap[smallestIndex].priority
    ) {
      smallestIndex = leftChildIndex;
    }

    if (
      rightChildIndex < this.heap.length &&
      this.heap[rightChildIndex].priority < this.heap[smallestIndex].priority
    ) {
      smallestIndex = rightChildIndex;
    }

    if (smallestIndex !== index) {
      this.swap(index, smallestIndex);
      this.bubbleDown(smallestIndex);
    }
  }

  protected swap(index1: number, index2: number): void {
    [this.heap[index1], this.heap[index2]] = [
      this.heap[index2],
      this.heap[index1]
    ];
  }

  public toString(): string {
    return this.heap.map((item) => item.toString()).join(", ");
  }
}

class Item<T> {
  constructor(public value: T, public priority: number) {}

  public toString(): string {
    return `(${this.priority}: '${this.value}')`;
  }
}
