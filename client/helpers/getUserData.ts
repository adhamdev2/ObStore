import { client } from "../index";




export const getUser = async (userId: string) => {
    try {
        const guild = (client as any).guild;
        if (!guild) return null
        const user = await guild.members.fetch(userId);
        if (!user) return null
        return user;
    } catch (error) {
        console.error("❌ Failed to fetch user:", error);
        return null;
    }
}