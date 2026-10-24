#!/bin/bash
echo "🔴 Freeing port 8000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
sleep 1
echo "✅ Port 8000 cleared"
echo "🚀 Starting EBEXTA on http://localhost:8000"
cd "/Users/arunv/NEXA V.01"
npm run dev
