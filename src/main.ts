import World from "./World";

const world = await World.create({
    size: [100,100]
})

world.loop()