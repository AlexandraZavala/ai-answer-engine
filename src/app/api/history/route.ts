import { Logger } from "@/app/utils/logger";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env["UPSTASH_REDIS_REST_URL"],
    token: process.env["UPSTASH_REDIS_REST_TOKEN"],
  });

const logger = new Logger("chatHistory");
  

export async function POST(req: Request){
    const {id, messages} = await req.json();
    console.log('id',id)
    console.log('messages',messages)
    try{
        logger.info(`Getting conversation for ${id}`);
        const response = await redis.set(`conversation:${id}`, JSON.stringify(messages), {ex: 7* 60 * 60 * 24});
        logger.info(`Conversation for ${id} saved`);
        return Response.json(response);
    } catch (error) {
        logger.error(`Error saving conversation for ${id}: ${error}`);
        return Response.json({error: "Error saving conversation"}, {status: 500});
    }
}


