// TODO: Implement the chat API with Groq and web scraping with Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk

// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer

import {getGroqClient} from '@/app/utils/groqClient'
import {urlPattern, scraperUrl} from '@/app/utils/scraper'

export async function POST(req: Request) {
  try {

    //if dynamic text -> puppeteer
    //consider a fallback for ai apis

    const {message, messages} = await req.json()

    //console.log('messages',messages)

    const url = message.match(urlPattern);

    let scrapedData = "";

    if(url){
        console.log('url',url);
        const scrappedResponse = await scraperUrl(url[0]);
        console.log('scrappedResponse',scrappedResponse);
        scrapedData = scrappedResponse?.content || '';
    }

    const userQuery = message.replace( url ? url[0] : '', '').trim();
    let userPrompt = "";
    if(scrapedData && url){
      userPrompt = `
        Answer my question "${userQuery}" based on the following content and context provided by the list of messages:
        <content>
        ${scrapedData}
        </content>
      `
    }else if(!url && !scrapedData){
      userPrompt = userQuery;
    }
    const listOfMessages = [
      ...messages,
      {role: 'user', content: userPrompt}
    ]

    const response = await getGroqClient(listOfMessages)

    return Response.json(response);
  } catch (error) {
    console.error(error);
    return Response.json(error);
  }
}
