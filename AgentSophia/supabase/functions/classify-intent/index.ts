import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClassifyRequest {
  message_content: string;
  channel?: string;
  sender_name?: string;
}

interface ClassifyResponse {
  intent_tag: string;
  confidence_score: number;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { message_content, channel, sender_name }: ClassifyRequest = await req.json();

    if (!message_content) {
      throw new Error("Message content is required");
    }

    const systemPrompt = `You are an expert AI assistant that analyzes customer responses to marketing and sales campaigns. 
Your job is to classify the intent of incoming messages based on their content.

Classify messages into one of these categories:
- interested: The person shows clear interest in the product/service, wants to learn more, or is ready to engage
- not_interested: The person explicitly declines, says no, or shows clear disinterest
- question: The person has questions about the product, service, pricing, or details
- objection: The person raises concerns, obstacles, or objections (price too high, not the right time, etc.)
- meeting_request: The person wants to schedule a call, meeting, or demo
- out_of_office: Automated out-of-office or vacation responder
- other: Anything that doesn't fit the above categories

Respond with a JSON object containing:
{
  "intent_tag": "one of the categories above",
  "confidence_score": 0.0 to 1.0,
  "reasoning": "brief explanation of why you chose this classification"
}`;

    const userPrompt = `Analyze this message and classify its intent:

Channel: ${channel || 'unknown'}
Sender: ${sender_name || 'unknown'}
Message: "${message_content}"

Provide your classification in JSON format.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const result: ClassifyResponse = JSON.parse(data.choices[0].message.content);

    // Validate the intent_tag
    const validIntents = [
      'interested',
      'not_interested',
      'question',
      'objection',
      'meeting_request',
      'out_of_office',
      'other'
    ];

    if (!validIntents.includes(result.intent_tag)) {
      result.intent_tag = 'other';
      result.confidence_score = 0.5;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in classify-intent function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
