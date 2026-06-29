
export const QUALITY_PRESETS = {
  // Camera capture quality (balance between speed and quality)
  camera: 0.60,
  
  // Photo library picker quality
  photoLibrary: 0.85,
  
  // Video quality from camera
  videoQuality: 'medium' as const,
};

export const performanceChecklist = {
  permissionCaching: '✅ Enabled - caches for 1 hour',
  cameraQuality: '✅ Optimized - 0.60 for fast capture',
  photoQuality: '✅ Optimized - 0.85 for gallery',
  compressionPipeline: '✅ Optimized - single-pass compression',
  maxDimensions: '✅ Optimized - 800px for chat',
  videoQuality: '✅ Optimized - Medium quality',
  uploadTimeout: '✅ Optimized - 120 seconds',
  uiFeedback: '✅ Instant - sheet closes immediately',
};
