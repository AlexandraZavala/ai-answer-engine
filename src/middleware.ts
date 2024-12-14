// TODO: Implement the code here to add rate limiting with Redis by sessions
// sliding window, rate limit
//use apikeys in the server

// Refer to the Next.js Docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
// Refer to Redis docs on Rate Limiting: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = new Redis({
  url: process.env["UPSTASH_REDIS_REST_URL"],
  token: process.env["UPSTASH_REDIS_REST_TOKEN"],
});

//To Prevent Abuse of the API
const ratelimit = new Ratelimit({
  redis: redis, //redis client
  limiter: Ratelimit.slidingWindow(5, "60 s"), //sliding window, 10 requests per 60 seconds
  analytics: true, //enable analytics
});

//Middleware to prevent abuse of the API: good way is to use by session
export async function middleware(request: NextRequest) {
  try {
    //get the ip address
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1"; // or other headers

    const { success, limit, reset, remaining } = await ratelimit.limit(ip);

    const response = success
      ? NextResponse.next()
      : NextResponse.json({ error: "Too many requests" }, { status: 429 });

    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());

    return response;

    //usser session
    //use server action, call in on the client
    //return response;
  } catch (error) {
    console.error("Error in middleware", error);
    return NextResponse.json({error: 'Internal server error'}, {status: 500});
  }
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
