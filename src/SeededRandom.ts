type Channel = "R" | "G" | "B";

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

export class WGSLGenerator {
    private rng: SeededRandom;

    private neighbors = ["current", "top", "bottom", "left", "right"];
    private channels: Channel[] = ["R", "G", "B"];

    private binaryOps = [
        "add", "sub", "mul",
        "avg", "diff",
        "react", "inhibit",
        "flow",
        "max", "min"
    ];

    private unaryOps = [
        "sigmoid",
        "smoothstep",
        "abs",
        "square",
        "invert",
        "damp",
        "boost",
        "wrap"
    ];

    constructor(seed: number) {
        this.rng = new SeededRandom(seed);
    }

    private pickInput(channel: Channel): string {
        const n = this.rng.pick(this.neighbors);
        return `n.${n}${channel}`;
    }

    private genUnary(v: string): string {
        const op = this.rng.pick(this.unaryOps);

        switch (op) {
            case "sigmoid":
                return `(1.0 / (1.0 + exp(-${v} * 6.0)))`;
            case "smoothstep":
                return `smoothstep(0.2, 0.8, ${v})`;
            case "abs":
                return `abs(${v})`;
            case "square":
                return `(${v} * ${v})`;
            case "invert":
                return `(1.0 - ${v})`;
            case "damp":
                return `(${v} * 0.97)`;
            case "boost":
                return `(${v} * 1.15)`;
            case "wrap":
                return `fract(${v})`;
        }

        return v;
    }

    private genBinary(a: string, b: string, channel: Channel): string {
        const op = this.rng.pick(this.binaryOps);

        switch (op) {
            case "add": return `(${a} + ${b})`;
            case "sub": return `(${a} - ${b})`;
            case "mul": return `(${a} * ${b})`;
            case "avg": return `((${a} + ${b}) * 0.5)`;
            case "diff": return `abs(${a} - ${b})`;
            case "react": return `(${a} * (1.0 - ${b}))`;
            case "inhibit": return `(${a} - ${a} * ${b})`;
            case "flow": return `(${a} + 0.25 * (${a} - ${b}))`;
            case "max": return `max(${a}, ${b})`;
            case "min": return `min(${a}, ${b})`;
        }

        return `(${a} + ${b})`;
    }

    private genExpression(channel: Channel, depth: number): string {
        if (depth <= 0) {
            return this.pickInput(channel);
        }

        const branch = this.rng.nextFloat();

        // Bias toward binary ops (interaction is key for life)
        if (branch < 0.65) {
            const a = this.genExpression(channel, depth - 1);
            const b = this.genExpression(channel, depth - 1);
            const expr = this.genBinary(a, b, channel);

            if (this.rng.nextFloat() < 0.4) {
                return this.genUnary(expr);
            }

            return expr;
        } else {
            const v = this.genExpression(channel, depth - 1);
            return this.genUnary(v);
        }
    }

    private genField(channel: Channel, depth: number): string {
        const expr = this.genExpression(channel, depth);

        return `
fn field${channel}(n: NeighborsRGB) -> f32 {
    let v = ${expr};
    return clamp(v, 0.0, 100.0);
}
`;
    }

    generate(depth = 5): string {
        return [
            this.genField("R", depth),
            this.genField("G", depth),
            this.genField("B", depth),
        ].join("\n");
    }
}
