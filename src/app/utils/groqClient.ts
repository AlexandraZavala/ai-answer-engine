import Groq from "groq-sdk";

const client = new Groq({
  apiKey: process.env["GROQ_API_KEY"], // This is the default and can be omitted
});

interface ChatMessage {
    role: "system" | "user" | "assistant",
    content: string
}

export async function getGroqClient(chatMessages: ChatMessage[]) {

  //console.log('chatMessages',chatMessages)
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        " You are an academic expert, you always cite your sources and base your response only on the context that you have been provided",
    },
    ...chatMessages
  ];

  console.log("Starting Groq Client request")

  const response = await client.chat.completions.create({
    messages: messages,
    model: "llama3-8b-8192",
  });

  console.log("Groq Client request completed")

  return response.choices[0].message.content;
}
