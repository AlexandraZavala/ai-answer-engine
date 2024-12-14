import { NextResponse } from "next/server";
import { Logger } from "@/app/utils/logger";
import {Redis} from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const logger = new Logger("chatHistory");


type Message = {
    role: string;
    content: string;
}

export async function GET(id: string){
    try{
        const conversation = await redis.get(`conversation:${id}`);
        if(!conversation){
            logger.info(`Conversation for ${id} not found`);
            return NextResponse.json({error: "Conversation not found"}, {status: 404});
        }

        return NextResponse.json(conversation as Message[]);
    } catch (error) {
        logger.error(`Error getting conversation for ${id}: ${error}`);
        return NextResponse.json({error: "Error getting conversation"}, {status: 500});
    }
}