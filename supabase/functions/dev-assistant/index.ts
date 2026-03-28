import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_MODELS: Record<string, string> = {
  "anthropic/claude-sonnet-4": "claude-sonnet-4-20250514",
  "anthropic/claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
  "anthropic/claude-sonnet-4-6": "claude-sonnet-4-6",
  "anthropic/claude-opus-4-6": "claude-opus-4-6",
  "anthropic/claude-haiku-4-5": "claude-haiku-4-5-20251001",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, codebaseIndex, fileContents, customInstructions, phase, user_api_key, model } = await req.json();

    const apiKey = user_api_key || Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No API key configured. Add your Anthropic key in Settings." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedModel = ANTHROPIC_MODELS[model] || "claude-sonnet-4-6";
    const instructionsSuffix = customInstructions ? "\n\n--- Custom Instructions ---\n" + customInstructions : "";

    let systemPrompt: string;
    let apiMessages: Array<{ role: string; content: string }>;
    let maxTokens: number;

    if (phase === "identify") {
      systemPrompt = "You are a codebase-aware debugging assistant for a React/TypeScript/Supabase app called Odyssey Assassin Forge. You have the complete file index of the codebase. The user will describe a bug, question, or feature request. Your ONLY job is to identify which source files (maximum 8) are most relevant to investigate. Respond with ONLY a raw JSON array of file paths. No markdown, no explanation, no backticks. Example: [\"src/hooks/use-combat-actions.ts\",\"src/components/combat/CombatTabScreen.tsx\"]" + instructionsSuffix;

      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
      const userContent = (codebaseIndex || "") + "\n\nUser's question: " + (lastUserMsg?.content || "");

      apiMessages = [{ role: "user", content: userContent }];
      maxTokens = 1024;
    } else {
      systemPrompt = `You are a codebase-aware debugging assistant for Odyssey Assassin Forge, a D&D companion app built in React, TypeScript, and Supabase. The developer is non-technical and uses Lovable.dev to make changes via prompts. You have been given the full source code of relevant files.

Your response should include:
1. A plain English explanation of the issue or answer
2. The exact file paths and function/component names involved
3. Concrete suggestions for what to change and where

IMPORTANT: Do NOT generate a Lovable prompt unless the user explicitly asks for one (e.g. "give me a Lovable prompt", "write me a prompt for Lovable", "how do I fix this in Lovable"). When the user DOES ask for a Lovable prompt, wrap it EXACTLY like this:
---LOVABLE_PROMPT_START---
(the full prompt text here, plain text, no markdown)
---LOVABLE_PROMPT_END---

This wrapper format is required so the app can detect and render it with a copy button. You can include multiple Lovable prompts if the fix requires sequential prompts. Always flag if a fix could break something else.` + (customInstructions ? "\n\n--- Developer's Custom Instructions ---\n" + customInstructions : "");

      // Build file contents preamble
      let filesPreamble = "Here are the relevant source files:\n\n";
      if (fileContents && fileContents !== "{}") {
        try {
          const parsed = typeof fileContents === "string" ? JSON.parse(fileContents) : fileContents;
          for (const [path, content] of Object.entries(parsed)) {
            filesPreamble += `=== FILE: ${path} ===\n${content}\n\n`;
          }
        } catch { /* ignore parse errors */ }
      }

      apiMessages = [
        { role: "user", content: filesPreamble },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      // Ensure alternating roles for Anthropic API
      const merged: typeof apiMessages = [];
      for (const msg of apiMessages) {
        if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
          merged[merged.length - 1].content += "\n\n" + msg.content;
        } else {
          merged.push({ ...msg });
        }
      }
      // Ensure last message is user role
      if (merged.length > 0 && merged[merged.length - 1].role !== "user") {
        merged.push({ role: "user", content: "Please continue your analysis." });
      }
      apiMessages = merged;
      maxTokens = 8192;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);

      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Invalid API key. Check Settings > Game Master > API Keys." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Anthropic API error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const textContent = data.content?.find((b: any) => b.type === "text")?.text || "";

    if (phase === "identify") {
      let filePaths: string[] = [];
      try {
        filePaths = JSON.parse(textContent);
      } catch {
        const match = textContent.match(/\[[\s\S]*?\]/);
        if (match) {
          try { filePaths = JSON.parse(match[0]); } catch { /* give up */ }
        }
      }
      if (!Array.isArray(filePaths)) filePaths = [];

      return new Response(JSON.stringify({ phase: "identify", filePaths }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ phase: "answer", content: textContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("dev-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
