export default class Stats {
    private sum: number = 0;
    private count: number = 0;

    add(value: number): void {
        this.sum += value;
        this.count += 1;
    }

    get avg(): number {
        return this.count === 0 ? 0 : this.sum / this.count;
    }
}