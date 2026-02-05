#!/bin/bash

# Simple deployment - one function at a time
# Run this in Replit Shell

echo "🚀 Deploying Agent Sophia Functions"
echo "===================================="
echo ""
echo "Project: fsbwkufvkuetrfimqhdf"
echo ""

# Deploy each function with clear output
echo "📦 Deploying 1/17: agent-sophia-orchestrator"
npx supabase functions deploy agent-sophia-orchestrator --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 2/17: agent-sophia-decision"
npx supabase functions deploy agent-sophia-decision --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 3/17: agent-sophia-followup"
npx supabase functions deploy agent-sophia-followup --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 4/17: agent-sophia-prospect"
npx supabase functions deploy agent-sophia-prospect --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 5/17: agent-sophia-campaign-creator"
npx supabase functions deploy agent-sophia-campaign-creator --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 6/17: agent-sophia-messenger"
npx supabase functions deploy agent-sophia-messenger --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 7/17: office365-send-email"
npx supabase functions deploy office365-send-email --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 8/17: office365-read-inbox"
npx supabase functions deploy office365-read-inbox --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 9/17: office365-book-meeting"
npx supabase functions deploy office365-book-meeting --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 10/17: office365-check-availability"
npx supabase functions deploy office365-check-availability --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 11/17: office365-refresh-token"
npx supabase functions deploy office365-refresh-token --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 12/17: office365-token-exchange"
npx supabase functions deploy office365-token-exchange --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 13/17: linkedin-oauth"
npx supabase functions deploy linkedin-oauth --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 14/17: linkedin-send-connection"
npx supabase functions deploy linkedin-send-connection --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 15/17: linkedin-send-message"
npx supabase functions deploy linkedin-send-message --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 16/17: linkedin-check-messages"
npx supabase functions deploy linkedin-check-messages --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "📦 Deploying 17/17: linkedin-create-post"
npx supabase functions deploy linkedin-create-post --project-ref fsbwkufvkuetrfimqhdf --no-verify-jwt
echo ""

echo "===================================="
echo "✅ All 17 functions deployed!"
echo "===================================="
echo ""
echo "Next steps:"
echo "1. Apply database migration in Supabase Dashboard"
echo "2. Add Edge Function secrets"
echo "3. Set up background scheduler"
