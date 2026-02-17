import World from "./World";

const world = await World.create({
    size: [innerWidth,innerHeight]
})

world.loopSync()
world.runDebug()
