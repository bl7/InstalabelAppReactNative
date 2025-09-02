#!/bin/bash

# Clean up old React Navigation icons and other unwanted icons
# Keep only our custom splash screen icons

echo "🧹 Cleaning up old React Navigation icons..."

# List of drawable folders to clean
drawable_folders=(
    "android/app/src/main/res/drawable-mdpi"
    "android/app/src/main/res/drawable-hdpi"
    "android/app/src/main/res/drawable-xhdpi"
    "android/app/src/main/res/drawable-xxhdpi"
    "android/app/src/main/res/drawable-xxxhdpi"
)

# Patterns to remove (React Navigation icons)
patterns_to_remove=(
    "node_modules_reactnavigation_*"
    "node_modules_*"
)

for folder in "${drawable_folders[@]}"; do
    if [ -d "$folder" ]; then
        echo "📁 Cleaning $folder..."
        
        # Remove React Navigation icons
        for pattern in "${patterns_to_remove[@]}"; do
            find "$folder" -name "$pattern" -type f -delete
        done
        
        # List remaining files
        remaining_files=$(ls "$folder" 2>/dev/null | wc -l)
        echo "   ✅ Cleaned. Remaining files: $remaining_files"
        
        # Show what's left
        if [ "$remaining_files" -gt 0 ]; then
            echo "   📄 Remaining files:"
            ls "$folder" 2>/dev/null | sed 's/^/      /'
        fi
    else
        echo "⚠️ Folder not found: $folder"
    fi
done

echo ""
echo "🎯 Only custom splash screen icons should remain now!"
echo "💡 These React Navigation icons will be regenerated on next build"
echo "   but they're just UI navigation icons, not your app icons."
