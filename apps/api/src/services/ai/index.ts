/**
 * AI Service Layer for Vara Image Scanning
 *
 * This module exports all AI-related services for image analysis:
 * - CLIP embedding generation for semantic image similarity
 * - Perceptual hashing for visual fingerprinting
 * - Reverse image search for finding image matches across the web
 * - Deepfake detection for identifying synthetic/manipulated images
 * - Face embedding extraction and comparison for identity verification
 *
 * All services support mock mode for development when API keys are not configured.
 * Set the corresponding environment variables to enable real API integrations:
 * - OPENAI_API_KEY: Enables real CLIP embeddings
 * - TINEYE_API_KEY: Enables TinEye reverse image search
 * - GOOGLE_VISION_API_KEY: Enables Google Vision reverse image search
 * - DEEPFAKE_API_KEY: Enables real deepfake detection
 * - DEEPFACE_SERVICE_URL: URL of DeepFace Python microservice (default: http://localhost:8000)
 */

// CLIP Embedding Service
export {
  clipService,
  ClipService,
  type ClipEmbeddingResult,
} from './clip.service';

// Perceptual Hash Service
export {
  perceptualHashService,
  PerceptualHashService,
  type PerceptualHashResult,
  type HashComparisonResult,
} from './perceptual-hash.service';

// Reverse Image Search Service
export {
  reverseImageService,
  ReverseImageService,
  type ReverseImageMatch,
  type ReverseImageSearchResult,
  type PersonDiscoveryScanOptions,
  type PersonDiscoveryScanResult,
  type ExpandedCandidate,
} from './reverse-image.service';

// Deepfake Detection Service
export {
  deepfakeService,
  DeepfakeService,
  type DeepfakeAnalysisDetails,
  type DeepfakeAnalysisResult,
} from './deepfake.service';

// Face Embedding Service (DeepFace)
export {
  faceEmbeddingService,
  FaceEmbeddingService,
  type FaceEmbeddingResult,
  type FaceComparisonResult,
} from './face-embedding.service';

// Scan Services (TinEye, etc.)
// Re-exported for convenience - can also import directly from '../scan'
export * from '../scan';
