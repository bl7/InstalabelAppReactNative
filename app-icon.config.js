module.exports = {
  // Source icon files
  icon: './assets/logo_sm.png',
  splashIcon: './assets/logo_long.svg',
  
  // Android configuration
  android: {
    // App icons for different densities
    mipmap: {
      mdpi: {
        size: 48,
        icon: 'ic_launcher.png',
        round: 'ic_launcher_round.png'
      },
      hdpi: {
        size: 72,
        icon: 'ic_launcher.png',
        round: 'ic_launcher_round.png'
      },
      xhdpi: {
        size: 96,
        icon: 'ic_launcher.png',
        round: 'ic_launcher_round.png'
      },
      xxhdpi: {
        size: 144,
        icon: 'ic_launcher.png',
        round: 'ic_launcher_round.png'
      },
      xxxhdpi: {
        size: 192,
        icon: 'ic_launcher.png',
        round: 'ic_launcher_round.png'
      }
    },
    
    // Adaptive icons (Android 8.0+)
    adaptive: {
      mdpi: {
        size: 108,
        foreground: 'ic_launcher_foreground.png',
        background: 'ic_launcher_background.png'
      },
      hdpi: {
        size: 162,
        foreground: 'ic_launcher_foreground.png',
        background: 'ic_launcher_background.png'
      },
      xhdpi: {
        size: 216,
        foreground: 'ic_launcher_foreground.png',
        background: 'ic_launcher_background.png'
      },
      xxhdpi: {
        size: 324,
        foreground: 'ic_launcher_foreground.png',
        background: 'ic_launcher_background.png'
      },
      xxxhdpi: {
        size: 432,
        foreground: 'ic_launcher_foreground.png',
        background: 'ic_launcher_background.png'
      }
    },
    
    // Splash screen icons
    splash: {
      mdpi: {
        size: 320,
        icon: 'splash_icon.png'
      },
      hdpi: {
        size: 480,
        icon: 'splash_icon.png'
      },
      xhdpi: {
        size: 640,
        icon: 'splash_icon.png'
      },
      xxhdpi: {
        size: 960,
        icon: 'splash_icon.png'
      },
      xxxhdpi: {
        size: 1280,
        icon: 'splash_icon.png'
      }
    }
  },
  
  // Output directory
  output: './android/app/src/main/res',
  
  // Icon settings
  iconSettings: {
    // Round corners for adaptive icons
    roundCorners: true,
    cornerRadius: 0.1, // 10% of icon size
    
    // Background color for adaptive icons
    backgroundColor: '#FFFFFF',
    
    // Padding for adaptive icons
    padding: 0.1, // 10% padding
    
    // Splash screen settings
    splashBackgroundColor: '#FFFFFF',
    splashIconSize: 0.6, // 60% of splash screen size
  }
};
