#!/bin/bash

# Generate Android Icons and Splash Screen
# Make sure you have placed your icon files in the assets/ folder

echo "🎨 Generating Android Icons and Splash Screen..."

# Check if icon files exist
if [ ! -f "assets/logo_sm.png" ]; then
    echo "❌ Error: assets/logo_sm.png not found!"
    echo "Please place your logo_sm.png file in the assets/ folder"
    exit 1
fi

if [ ! -f "assets/logo_long.svg" ]; then
    echo "❌ Error: assets/logo_long.svg not found!"
    echo "Please place your logo_long.svg file in the assets/ folder"
    exit 1
fi

# Copy the app icon to the root as icon.png (app-icon expects this)
echo "📋 Preparing icon files..."
cp assets/logo_sm.png icon.png

# Generate Android app icons using app-icon tool
echo "📱 Generating Android app icons..."
app-icon generate -i icon.png -p android --adaptive-icons

# Clean up temporary icon file
rm icon.png

# Generate splash screen icons manually using ImageMagick or similar
echo "🖼️ Generating splash screen icons..."

# Create drawable folders if they don't exist
mkdir -p android/app/src/main/res/drawable-mdpi
mkdir -p android/app/src/main/res/drawable-hdpi
mkdir -p android/app/src/main/res/drawable-xhdpi
mkdir -p android/app/src/main/res/drawable-xxhdpi
mkdir -p android/app/src/main/res/drawable-xxxhdpi

# Check if ImageMagick is available for splash screen generation
if command -v magick &> /dev/null; then
    echo "🖼️ Using ImageMagick to generate splash screen icons..."
    
    # MDPI Splash (320x320)
    magick assets/logo_long.svg -resize 320x320 android/app/src/main/res/drawable-mdpi/splash_icon.png
    
    # HDPI Splash (480x480)
    magick assets/logo_long.svg -resize 480x480 android/app/src/main/res/drawable-hdpi/splash_icon.png
    
    # XHDPI Splash (640x640)
    magick assets/logo_long.svg -resize 640x640 android/app/src/main/res/drawable-xhdpi/splash_icon.png
    
    # XXHDPI Splash (960x960)
    magick assets/logo_long.svg -resize 960x960 android/app/src/main/res/drawable-xxhdpi/splash_icon.png
    
    # XXXHDPI Splash (1280x1280)
    magick assets/logo_long.svg -resize 1280x1280 android/app/src/main/res/drawable-xxxhdpi/splash_icon.png
    
else
    echo "⚠️ ImageMagick not found. Splash screen icons will need to be generated manually."
    echo "💡 Install ImageMagick: brew install imagemagick (macOS) or apt-get install imagemagick (Ubuntu)"
    echo "💡 Or manually resize logo_long.svg to the required sizes:"
    echo "   - MDPI: 320x320"
    echo "   - HDPI: 480x480"
    echo "   - XHDPI: 640x640"
    echo "   - XXHDPI: 960x960"
    echo "   - XXXHDPI: 1280x1280"
fi

echo "✅ App icons generated successfully!"
echo "📁 Icons are now in: android/app/src/main/res/"
echo "🎯 Don't forget to update your AndroidManifest.xml to use the new icons"
