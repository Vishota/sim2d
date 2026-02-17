import World from "./World";

const world = await World.create({
    size: [1000,1000]
})

world.loop()
world.runDebug()