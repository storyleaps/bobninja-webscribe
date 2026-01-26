#!/bin/bash
# Version verification script
# Checks that all version numbers are in sync

echo "========================================================================"
echo "EXTENSION VERSION CHECK"
echo "========================================================================"

MANIFEST_VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
SW_VERSION=$(grep 'SERVICE_WORKER_VERSION = ' service-worker.js | head -1 | sed "s/.*'\(.*\)'.*/\1/")
TAB_FETCHER_VERSION=$(grep 'TAB_FETCHER_VERSION = ' lib/tab-fetcher.js | head -1 | sed "s/.*'\(.*\)'.*/\1/")

echo ""
echo "Current versions:"
echo "  manifest.json:        $MANIFEST_VERSION"
echo "  service-worker.js:    $SW_VERSION"
echo "  lib/tab-fetcher.js:   $TAB_FETCHER_VERSION"
echo ""

# Check if all match
if [ "$MANIFEST_VERSION" = "$SW_VERSION" ] && [ "$SW_VERSION" = "$TAB_FETCHER_VERSION" ]; then
    echo "✅ All versions match: $MANIFEST_VERSION"
else
    echo "⚠️  Version mismatch detected!"
    echo ""
    echo "   Expected: All should be $MANIFEST_VERSION (from manifest.json)"
    echo ""
    echo "   Action needed:"
    if [ "$SW_VERSION" != "$MANIFEST_VERSION" ]; then
        echo "   - Update SERVICE_WORKER_VERSION in service-worker.js to '$MANIFEST_VERSION'"
    fi
    if [ "$TAB_FETCHER_VERSION" != "$MANIFEST_VERSION" ]; then
        echo "   - Update TAB_FETCHER_VERSION in lib/tab-fetcher.js to '$MANIFEST_VERSION'"
    fi
fi

echo ""
echo "========================================================================"
echo "RELOAD INSTRUCTIONS"
echo "========================================================================"
echo ""
echo "After making changes:"
echo ""
echo "1. If you changed React/TypeScript files:"
echo "   cd popup && npm run build"
echo ""
echo "2. Reload extension in Chrome:"
echo "   chrome://extensions/ → Click reload icon ↻"
echo ""
echo "3. Verify version in Service Worker console:"
echo "   chrome://extensions/ → Click 'service worker'"
echo "   Look for: 🚀 Service worker v$MANIFEST_VERSION started"
echo ""
echo "4. If changes still don't load:"
echo "   Option A: Remove extension → Load unpacked again"
echo "   Option B: Restart Chrome completely"
echo ""
