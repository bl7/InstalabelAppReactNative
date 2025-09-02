/**
 * Generate a fallback image when image capture fails
 * This provides a basic fallback to prevent app crashes
 */

/**
 * Generate a simple fallback image string
 * In a real implementation, this would generate an actual image
 * For now, it returns a placeholder string
 */
export const generateFallbackImage = (labelContent: string): string => {
  console.log('⚠️ Using fallback image for:', labelContent);

  // Return a simple placeholder - in a real app this would generate an actual image
  // This prevents the app from crashing when the real image capture fails
  return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
};

export default generateFallbackImage;
