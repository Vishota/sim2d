class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed >>> 0;
    }

    next(): number {
        let t = (this.seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    nextFloat(min = 0, max = 1) {
        return this.next() * (max - min) + min;
    }

    nextInt(min: number, max: number) {
        return Math.floor(this.nextFloat(min, max + 1));
    }

    pick<T>(arr: T[]) {
        return arr[this.nextInt(0, arr.length - 1)];
    }
}

type Channel = "R" | "G" | "B";

export class WGSLGenerator {
    private rng: SeededRandom;

    private neighbors = ["current", "top", "bottom", "left", "right"];
    private channels: Channel[] = ["R", "G", "B"];

    private binaryOps = [
        "add",
        "sub",
        "mul",
        "max",
        "min",
        "mix"
    ];

    private unaryOps = [
        "sin",
        "cos",
        "abs",
        "fract",
        "neg"
    ];

    constructor(seed: number) {
        this.rng = new SeededRandom(seed);
    }

    private pickInput(): string {
        const n = this.rng.pick(this.neighbors);
        const c = this.rng.pick(this.channels);
        return `n.${n}${c}`;
    }

    private genBinary(a: string, b: string): string {
        const op = this.rng.pick(this.binaryOps);

        switch (op) {
            case "add": return `(${a} + ${b})`;
            case "sub": return `(${a} - ${b})`;
            case "mul": return `(${a} * ${b})`;
            case "max": return `max(${a}, ${b})`;
            case "min": return `min(${a}, ${b})`;
            case "mix":
                const t = this.rng.nextFloat(0, 1).toFixed(4);
                return `mix(${a}, ${b}, ${t})`;
        }

        return `(${a} + ${b})`;
    }

    private genUnary(v: string): string {
        const op = this.rng.pick(this.unaryOps);

        switch (op) {
            case "sin": return `sin(${v})`;
            case "cos": return `cos(${v})`;
            case "abs": return `abs(${v})`;
            case "fract": return `fract(${v})`;
            case "neg": return `(-${v})`;
        }

        return v;
    }

    private genField(channel: Channel, depth: number): string {
        const lines: string[] = [];
        lines.push(`fn field${channel}(n: NeighborsRGB) -> f32 {`);

        const tempVars: string[] = [];

        // создаем стартовые входы
        const inputsCount = this.rng.nextInt(3, 6);

        for (let i = 0; i < inputsCount; i++) {
            const name = `v${i}`;
            const input = this.pickInput();
            lines.push(`    var ${name}: f32 = ${input};`);
            tempVars.push(name);
        }

        let currentIndex = inputsCount;

        // комбинируем значения
        for (let i = 0; i < depth; i++) {
            const a = this.rng.pick(tempVars);
            const b = this.rng.pick(tempVars);

            const expr = this.genBinary(a, b);
            const maybeUnary = this.rng.nextFloat() > 0.5
                ? this.genUnary(expr)
                : expr;

            const newVar = `v${currentIndex++}`;
            lines.push(`    var ${newVar}: f32 = ${maybeUnary};`);

            tempVars.push(newVar);
        }

        const result = this.rng.pick(tempVars);
        lines.push(`    return ${result};`);
        lines.push(`}`);

        return lines.join("\n");
    }

    generate(depth = 4): string {
        return [
            this.genField("R", depth),
            this.genField("G", depth),
            this.genField("B", depth),
        ].join("\n\n");
    }
}
