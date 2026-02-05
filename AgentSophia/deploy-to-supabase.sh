#!/bin/bash

# Agent Sophia - Supabase Deployment Script
# This script deploys all Edge Functions to your Supabase project

set -e  # Exit on error

echo "🚀 Agent Sophia - Supabase Deployment"
echo "======================================"
echo ""
echo "ℹ️  Using npx to run Supabase CLI (no global install needed)"
echo ""

# Step 1: Login to Supabase
echo "📝 Step 1: Login to Supabase"
echo "-----------------------------"
npx supabase login

# Step 2: Link project
echo ""
echo "🔗 Step 2: Link your Supabase project"
echo "--------------------------------------"
echo "You can find your project ref in Supabase Dashboard → Project Settings → General"
read -p "Enter your Supabase Project Ref: " PROJECT_REF
npx supabase link --project-ref "$PROJECT_REF"

# Step 3: Deploy Edge Functions
echo ""
echo "📦 Step 3: Deploying Edge Functions"
echo "-----------------------------------"

FUNCTIONS=(
    "agent-sophia-orchestrator"
    "agent-sophia-decision"
    "agent-sophia-followup"
    "agent-sophia-prospect"
    "agent-sophia-campaign-creator"
    "agent-sophia-messenger"
    "office365-send-email"
    "office365-read-inbox"
    "office365-book-meeting"
    "office365-check-availability"
    "office365-refresh-token"
    "office365-token-exchange"
    "linkedin-oauth"
    "linkedin-send-connection"
    "linkedin-send-message"
    "linkedin-check-messages"
    "linkedin-create-post"
)

DEPLOYED=0
FAILED=0

for func in "${FUNCTIONS[@]}"; do
    echo ""
    echo "Deploying: $func..."
    if npx supabase functions deploy "$func" --no-verify-jwt; then
        echo "✅ $func deployed successfully"
        ((DEPLOYED++))
    else
        echo "❌ $func deployment failed"
        ((FAILED++))
    fi
done

echo ""
echo "======================================"
echo "📊 Deployment Summary"
echo "======================================"
echo "✅ Successfully deployed: $DEPLOYED functions"
echo "❌ Failed: $FAILED functions"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All Edge Functions deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Apply database migration (see DEPLOYMENT_GUIDE.md)"
    echo "2. Set up Edge Function secrets"
    echo "3. Configure background scheduler"
else
    echo "⚠️  Some deployments failed. Please check the errors above."
fi
