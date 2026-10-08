import { UserDB } from "./models/User.js";

async function test() {
    await UserDB.init();
    console.log("Memory Map Size:", (await UserDB.findAll()).length);
    
    let user = await UserDB.findById("811571425923563570");
    console.log("User before:", user?.downloads);
    
    const downloads = user?.downloads || [];
    downloads.push({
        id: "v6",
        name: "Test v6",
        version: "v6",
        type: "version",
        date: new Date().toISOString(),
        files: []
    });
    
    await UserDB.update("811571425923563570", { downloads, updatedAt: new Date() });
    
    user = await UserDB.findById("811571425923563570");
    console.log("User after:", user?.downloads);
}

test().catch(console.error);
