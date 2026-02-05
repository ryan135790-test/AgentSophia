# AI Lead Platform - Agent Sophia

## Overview
The AI Lead Platform automates AI-driven lead generation and outreach across multiple channels to streamline processes, boost engagement, and improve conversion rates for sales and marketing professionals. It provides a unified AI-powered workflow and campaign generation experience, leveraging advanced AI to offer a competitive edge. Key capabilities include a unified inbox with AI intent classification, multichannel campaign building, social media management, an autonomous AI sales agent (Agent Sophia), and comprehensive analytics. The platform's ambition is to act as a unified Chief Marketing & Sales Officer.

## User Preferences
- Iterative development approach
- Ask before making major changes
- Provide detailed explanations
- Do not make changes to the folder `Z`
- Do not make changes to the file `Y`
- Agent Sophia should be described as an "Autonomous AI Agent: A software program capable of reasoning, planning, and executing complex tasks and workflows on its own" when introducing herself in chat
- Build quickly with rapid deployment
- Prioritize user control and navigation
- Make features accessible and discoverable
- Keep left-hand sidebar navigation visible on all pages for easy navigation
- Unified Inbox: 3-column layout (message list | message content | actions + AI) with status management, tagging, assignment, and quick actions
- Sophia should be integrated across ALL pages with insights, recommendations, and autonomous controls

## System Architecture
The application is built with Vite, React, TypeScript, shadcn-ui, and Tailwind CSS for the frontend, using React Router DOM for navigation and TanStack Query for data management. Supabase handles authentication; Replit PostgreSQL handles persistent data.

**UI/UX Decisions:**
Modern UI inspired by SmartReach.io featuring shadcn-ui + Tailwind CSS. Persistent Icon Rail Sidebar, progressive disclosure, card-based layouts, at-a-glance metrics. Mobile-optimized and responsive. Sophia is integrated across all major pages with AI insights, recommendations, and control surfaces, including a persistent Sophia Header.

**Technical Implementations:**
- **AI Integration (Dual LLM):** GPT-4o (OpenAI) + Claude-sonnet-4-5 (Anthropic via Replit) with consensus voting & graceful fallback.
- **Agent Sophia:** Autonomous AI agent with a learning engine, autonomous executor, confidence models, dual-LLM support, intent detection, account scoring, and revenue analytics. Features a Brain Control Panel for managing autonomy, approval thresholds, learning mode, and persistent memory with Sophia Insights. Sophia is integrated across the platform, including a real-time activity monitoring popup (Sophia Live Popup) using Server-Sent Events (SSE).
- **Unified Inbox:** 3-column layout with AI intent detection, quick actions, and Sophia auto-actions for message evaluation.
- **Multichannel Campaign Execution:** Supports Email, SMS, LinkedIn, Phone, Voicemail with real API sending, managed by a Visual Workflow Builder (React Flow).
- **AI Campaign Content Generation & Brand Voice Management:** Sophia generates content tailored to user-defined brand voices and templates.
- **Autonomy System & Admin Brain Control:** Admins control Sophia's autonomy level and approval thresholds, with a three-tier autonomy system: manual_approval, semi_autonomous, fully_autonomous with channel-based confidence defaults.
- **Advanced Analytics Dashboard:** Revenue metrics, performance tracking, ROI analytics, and AI recommendations with an A/B Testing Framework.
- **Workspace Management:** User management with role-based access, workspace-level API key management for AI (OpenAI) and Email (Resend).
- **Contact & Deal Management:** Internal CRM with contact detail view, activity timeline, tasks, notes, meeting scheduling, CSV import, deal pipeline tracking, and Sophia health scoring.
- **LinkedIn Automation:** Dual-method automation: **Voyager API for search** (bypasses browser detection, direct HTTP requests to LinkedIn's internal API) with **Puppeteer fallback** for browser automation. Features human-like behavior, workspace-level session isolation, and safety controls. Supports quick login via Decodo mobile sticky proxies (port 7000) or manual session via cookies. Features session health monitoring, a keep-alive service, and lead scraping. Includes autonomous compliance oversight (Sophia LinkedIn Compliance Monitor). Multi-account LinkedIn support per workspace.
- **System Proxy Pool:** Centralized mobile sticky proxy management for LinkedIn automation with automatic proxy failover and health tracking.
- **Sophia Email Manager:** Autonomous email management with predictive send-time optimization, AI content generation, reply classification, auto-warmup, and multi-provider email support.
- **Lookup Credits System:** Daily credit allocation for enrichment lookups across workspaces, with super admin credit management.
- **Campaign Executor Service:** Background job processes scheduled campaign steps with autonomy gating and LinkedIn auto-scheduling with safety controls.
- **Sophia Campaign Matcher:** AI-powered lead-to-campaign assignment using GPT-4o-mini with heuristic fallback and a 3-tier autonomy system.
- **Advanced Campaign Management Suite:** Includes Campaign Calendar View, Health Dashboard, Bulk Operations, Folders & Tags, Comparison Tool, Smart Send Time, Version History, Live Preview, Dependencies, and Response Inbox. Features a Campaign Template Catalog and Sophia Workflow Synthesis for natural language to campaign workflow generation.
- **Workflow-to-Campaign Deployment:** Visual Workflow Builder fully integrated with Campaign Executor for deploying multi-step campaigns, with Sophia compliance checks and LinkedIn Puppeteer automation.
- **Platform Help Bot:** AI-powered in-app help assistant with documentation, navigation links, and conversational guidance.

## External Dependencies
- **Supabase:** Authentication
- **Replit PostgreSQL:** Data persistence
- **OpenAI:** GPT-4o for AI
- **Anthropic:** Claude via Replit AI Integrations
- **LinkedIn API Proxy:** Backend API for LinkedIn automation
- **Hunter.io:** Email enrichment API
- **Apollo.io:** Secondary email enrichment service
- **Vite:** Frontend tooling
- **React/TypeScript:** UI development
- **shadcn-ui:** Component library
- **Tailwind CSS:** Styling
- **React Router:** Routing
- **TanStack Query:** Data fetching
- **Zod:** Schema validation
- **Resend:** Email API
- **Google Calendar API:** Meeting scheduling and integration
- **Meta WhatsApp Business API:** WhatsApp messaging