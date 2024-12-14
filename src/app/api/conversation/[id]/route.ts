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

export async function GET(request: Request,{params}: {params: {id: string}}){
    console.log("Fetching conversation with ID:", params.id);
  
    try{
        console.log(params.id);
        const conversation = await redis.get(`conversation:${params.id}`);
        if(!conversation){
            logger.info(`Conversation for ${params.id} not found`);
            return NextResponse.json({error: "Conversation not found"}, {status: 404});
        }
        console.log(conversation);
        return NextResponse.json(conversation as Message[]);
    } catch (error) {
        logger.error(`Error getting conversation for ${params.id}: ${error}`);
        return NextResponse.json({error: "Error getting conversation"}, {status: 500});
    }
}