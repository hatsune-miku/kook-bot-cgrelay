import { PriorityQueue } from "./pqueue";

export class KMessageQueue<T> extends PriorityQueue<T> {
  /**
   * 将 `lastSn` 也作为 priority 计入后，整个队列的 priority 是否严格递增，
   * 且递增的步长为 1。
   */
  public isPriorityStrictAscending(lastSn: number): boolean {
    const priorities = [...this.heap.map((item) => item.priority), lastSn].sort(
      (a, b) => a - b
    );
    for (let i = 1; i < priorities.length; i++) {
      if (priorities[i] - priorities[i - 1] !== 1) {
        return false;
      }
    }
    return true;
  }
}
