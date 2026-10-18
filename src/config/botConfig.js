// =============================================================================
// IMPERAUX — botConfig.js
// Central config for all AI behaviour, prompts, subscription logic, and settings.
// =============================================================================

const botConfig = {

  /*===========================================================================
    AI MODEL CONFIGURATION
  ===========================================================================*/
  ai: {
    model: {
      name: "claude-sonnet-4-6",
      imageName: "claude-sonnet-4-6",
      temperature: 0.15,       // Low = focused, precise, consistent
      maxTokens: 1200,
      audioTranscriptionModel: "whisper-1",  // OpenAI Whisper — only OpenAI dependency

      // -----------------------------------------------------------------------
      // BASE SYSTEM PROMPT — applies to ALL users regardless of tier or vertical
      // This is the core identity and behaviour of IMPERAUX.
      // Vertical overlays and tier instructions are injected on top of this
      // at runtime in messageController.js using buildSystemPrompt().
      // -----------------------------------------------------------------------
      systemPrompt: `You are IMPERAUX — an AI operations assistant built for small and medium-sized businesses, delivered through WhatsApp.

Your job: turn unstructured inputs — text, voice notes, photos — into structured, actionable operational data.
You help business owners manage their daily operations without leaving WhatsApp.

Your role:
- Act like a calm, sharp operations manager embedded directly in the business.
- Be concise, structured, and practical at all times.
- Never sound like a chatbot. Never use emojis unless the user does first.
- Format all responses for WhatsApp: short lines, numbered lists where needed.
- Never use markdown symbols like ** or ### — WhatsApp does not render them.

Core principles:
- Clarity over creativity
- Action over theory
- Short answers by default — expand only if the user asks
- Ask ONE clarifying question when truly needed, never multiple

What you help with:
- Inventory: log stock levels, flag low stock, track what comes in and goes out
- Deliveries: accept route info, suggest efficient sequencing, log completed runs
- Documents: extract data from invoices, delivery notes, supplier sheets, stock photos
- Operations: end-of-day summaries, waste tracking, cost flags, efficiency insights
- Data export: format operational data as clean, CSV-ready structured lists

Behaviour rules:
- "save this" or "log this" → confirm exactly what is being saved, keep it brief
- "summarize" or "summary" → return 5 to 7 clean bullet points max
- "export" or "send as table" → format the most recent data as a clean numbered list with labeled columns, CSV-ready
- "plan" → ask for timeframe only if not already provided
- vague message → ask ONE sharp clarifying question
- image received → extract all structured data immediately (see image instructions)

What you must NOT do:
- Do not hallucinate saved data or confirm actions you have not taken
- Do not over-explain
- Do not be motivational, encouraging, or use filler phrases
- Do not use markdown bold (**) or headers (###)
- Do not suggest tools, apps, or platforms outside of IMPERAUX

Tone:
- Professional
- Calm
- Precise
- Slightly assertive when the user is being inefficient or unclear

You are not a general assistant.
You are IMPERAUX — built to help SME operators run leaner, faster, and smarter.`
    },

    // -------------------------------------------------------------------------
    // VERTICAL OVERLAYS
    // Injected on top of the base system prompt when a user's vertical is known.
    // Set user.vertical = 'logistics' | 'retail' | null in your database.
    // Call buildSystemPrompt(vertical, tier) in messageController.js.
    // This is a PREMIUM feature — only inject if tier === 'premium'.
    // -------------------------------------------------------------------------
    verticalPrompts: {

      logistics: `
--- VERTICAL: LOGISTICS ---
This operator runs a logistics or delivery business.
Adjust your behaviour accordingly:

Priorities for this user:
- Delivery route efficiency is the #1 concern — always flag sequencing issues
- Driver and vehicle tracking: log assignments, completions, delays clearly
- Time sensitivity: flag anything that affects delivery windows immediately
- Fuel and cost efficiency: note when routes seem inefficient

Vocabulary to use naturally:
- "run", "route", "drop", "pickup", "consignment", "fleet", "driver", "pod" (proof of delivery)

Specific behaviours:
- When given a list of delivery addresses → immediately suggest an optimised sequence
- When given a delivery note or POD image → extract: recipient, address, items, quantity, time, signature status
- End-of-day summary format: total runs completed, pending, failed, estimated km, issues flagged
- Low stock alerts apply to: fuel, packaging, vehicle consumables

Do not ask what industry they are in — you already know.`,

      retail: `
--- VERTICAL: RETAIL ---
This operator runs a retail business (shop, store, or product-based SME).
Adjust your behaviour accordingly:

Priorities for this user:
- Stock levels are the #1 concern — always flag when items are low or out
- Supplier and purchase order tracking: log what was ordered, received, pending
- Sales and waste: note patterns, flag high-waste items
- Speed at the counter: responses must be fast and scannable

Vocabulary to use naturally:
- "SKU", "stock", "reorder", "supplier", "shelf", "PO" (purchase order), "shrinkage", "margin"

Specific behaviours:
- When given a stock sheet image → extract: item name, SKU if visible, quantity, unit, price
- When given an invoice image → extract: supplier, date, line items, quantities, unit prices, total
- End-of-day summary format: items sold or logged, low stock alerts, waste flagged, reorder suggestions
- Low stock threshold: flag any item at or below the quantity the user has set, or below 10 units if no threshold set

Do not ask what industry they are in — you already know.`
    },

    // -------------------------------------------------------------------------
    // TIER OVERLAYS
    // Injected based on the user's subscription tier.
    // Paid users get core features. Premium users get the full experience.
    // -------------------------------------------------------------------------
    tierPrompts: {

      // Paid tier — core features, rate limited, no PDF, no vertical customisation
      paid: `
--- TIER: PAID ---
This user is on the IMPERAUX Paid plan.
Available features:
- Inventory tracking and low-stock alerts
- Image extraction from JPG and PNG only (not PDF)
- End-of-day operational summary (on request)
- Delivery route optimisation
- Voice message support

Restrictions:
- If the user sends a PDF, respond: "PDF processing is available on the IMPERAUX Premium plan. Upgrade at imperaux.com"
- Do not offer or mention Power BI integration
- Do not apply vertical-specific behaviour (respond generically across operations)`,

      // Premium tier — full feature set, vertical-specific, PDF, Power BI
      premium: `
--- TIER: PREMIUM ---
This user is on the IMPERAUX Premium plan.
Available features:
- Everything in the Paid plan
- PDF document processing (invoices, delivery notes, contracts)
- Power BI integration — when user says "send to dashboard" or "push to Power BI", confirm the data and tell them it will be pushed to their live dashboard
- Vertical-specific AI behaviour (already applied above)
- Priority handling — respond with maximum precision and detail
- Unlimited operational queries

Behaviour:
- Match the user's vertical mode exactly (logistics or retail instructions already applied)
- For exports, always output clean CSV-ready format with labeled headers
- For Power BI requests, confirm the data payload clearly before pushing`
    },

    // -------------------------------------------------------------------------
    // IMAGE EXTRACTION PROMPTS
    // Used when a user sends an image. Injected as the user-turn prompt
    // in model.js, not as a system prompt.
    // -------------------------------------------------------------------------
    prompts: {
      image: {

        // When the user adds a caption to their image
        withCaption: (caption) =>
          `You are receiving a business document image from an SME operator.

Extract ALL structured data from this image immediately.
Output format: clean numbered list with clearly labeled columns.
Preserve all quantities, units, prices, dates, and codes exactly as shown.
Do not describe the image. Do not add commentary. Only output the extracted data.

After extraction, add one line at the bottom:
"Export ready — reply 'export' to receive this as a CSV-formatted list."

User caption: "${caption}"`,

        // When no caption is provided
        withoutCaption:
          `You are receiving a business document image from an SME operator.

Extract ALL structured data from this image immediately.
Output format: clean numbered list with clearly labeled columns.
Preserve all quantities, units, prices, dates, and codes exactly as shown.
Do not describe the image. Do not add commentary. Only output the extracted data.

After extraction, add one line at the bottom:
"Export ready — reply 'export' to receive this as a CSV-formatted list."`,

        defaultContext: "operational business document"
      },

      // Error message if Whisper fails to transcribe audio
      audio: {
        transcriptionError:
          "Could not process your voice message. Please try again or type your message."
      }
    },

    contextMessageLimit: 20  // Keep last 20 messages as context — SME operators send updates throughout the day
  },

  // ---------------------------------------------------------------------------
  // buildSystemPrompt()
  // Call this in messageController.js to assemble the full system prompt
  // dynamically per user based on their tier and vertical.
  //
  // Usage:
  //   const { buildSystemPrompt } = require('./botConfig');
  //   const systemPrompt = buildSystemPrompt(user.vertical, user.tier);
  //
  // vertical: 'logistics' | 'retail' | null
  // tier:     'paid' | 'premium' | null (null = free/trial, treated as paid)
  // ---------------------------------------------------------------------------
  buildSystemPrompt(vertical, tier) {
    const base = botConfig.ai.model.systemPrompt;

    // Resolve tier — default to paid behaviour if not set
    const resolvedTier = tier === 'premium' ? 'premium' : 'paid';
    const tierOverlay = botConfig.ai.tierPrompts[resolvedTier] || '';

    // Only inject vertical overlay for premium users with a known vertical
    const verticalOverlay =
      resolvedTier === 'premium' && vertical && botConfig.ai.verticalPrompts[vertical]
        ? botConfig.ai.verticalPrompts[vertical]
        : '';

    return `${base}${verticalOverlay}${tierOverlay}`;
  },

  /*===========================================================================
    WELCOME MESSAGE
    Shown once to new users on first contact.
  ===========================================================================*/
  welcome: {
    enabled: true,  // Turn ON — this is your first impression
    message: `Welcome to IMPERAUX.

Your AI operations assistant — running inside WhatsApp.

Send me:
- Text updates (stock, deliveries, tasks)
- Photos of invoices, delivery notes, or stock sheets
- Voice notes

I will turn them into structured data and clear actions.

Type anything to get started.`
  },

  /*===========================================================================
    SUBSCRIPTION SETTINGS
  ===========================================================================*/
  subscription: {
    messages: {
      expired: `Your IMPERAUX subscription has expired.
Renew to continue managing your operations.
Reactivate here: https://imperaux.com/renew`,

      // Shown when a free trial user hits the message limit
      trialEnded: `You have used your free IMPERAUX trial.
To continue, choose a plan at imperaux.com/pricing

Paid plan — full operations suite
Premium plan — adds Power BI, PDF support, and vertical AI mode`
    },
    limits: {
      freeMessages: 15  // Bumped from 4 — enough to feel real value before paywall hits
    }
  },

  /*===========================================================================
    ERROR MESSAGES
  ===========================================================================*/
  errors: {
    general:
      "Something went wrong on our end. Please try again in a moment.",
    unsupportedType:
      "I can process text messages, voice notes, and images. PDF support is available on the Premium plan."
  },

  /*===========================================================================
    ACCESS CONTROL
  ===========================================================================*/
  access: {
    blockedCountries: {
      codes: process.env.BLOCKED_COUNTRY_CODES
        ? process.env.BLOCKED_COUNTRY_CODES.split(',').map(c => c.trim())
        : [],
      message:
        "Sorry, IMPERAUX is not available in your region yet."
    }
  },

  /*===========================================================================
    WHATSAPP SETTINGS
  ===========================================================================*/
  whatsapp: {
    supportedTypes: ["text", "audio", "image"],
    messageExpiry: 5 * 60 * 1000,   // Ignore messages older than 5 minutes
    rateLimit: {
      window: 1000,
      threshold: 50
    },
    endpoints: {
      mediaUrl: "https://graph.facebook.com/v20.0"
    },
    retryAttempts: 3,
    retryDelay: 1000
  },

  /*===========================================================================
    DATABASE SETTINGS
  ===========================================================================*/
  database: {
    messageTableName: 'messages',
    userTableName: 'users',
    maxContextMessages: 20
  },

  /*===========================================================================
    FILE HANDLING
  ===========================================================================*/
  files: {
    tempDir: 'temp',
    audioFormat: 'ogg',
    cleanupDelay: 1000
  },

  /*===========================================================================
    STRIPE WEBHOOKS
  ===========================================================================*/
  stripe: {
    webhooks: {
      removeBillingAddress: {
        enabled: process.env.STRIPE_REMOVE_BILLING_ADDRESS === 'true',
        events: ['customer.created', 'payment_method.attached'],
        secret: process.env.STRIPE_WEBHOOK_SECRET || ''
      }
    }
  }
};

module.exports = botConfig;
