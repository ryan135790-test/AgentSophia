#!/bin/bash

# Deploy office365-read-inbox Edge Function to Supabase
# This script uses npx to avoid installation issues

echo "🚀 Deploying office365-read-inbox Edge Function..."

# Check if we can use npx
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js first."
    exit 1
fi

# Deploy using npx (no installation needed)
npx supabase functions deploy office365-read-inbox --project-ref fsbwkufvkuetrfimqhdf

echo "✅ Deployment complete!"
echo ""
echo "📧 Test it now:"
echo "   Go to Agent Sophia → Email tab"
echo "   Your Office 365 emails should load automatically"
