import crypto from 'crypto';

/**
 * Detailed analysis results from deepfake detection.
 */
export interface DeepfakeAnalysisDetails {
  facesDetected: number;
  artifactsFound: string[];
  consistencyScore: number;
  compressionAnomalies: boolean;
  lightingAnalysis: 'consistent' | 'inconsistent' | 'inconclusive';
  modelVersion: string;
}

/**
 * Result from deepfake analysis.
 */
export interface DeepfakeAnalysisResult {
  isDeepfake: boolean;
  confidence: number;
  analysisDetails: DeepfakeAnalysisDetails;
  processingTimeMs: number;
}

/**
 * Environment variable for deepfake detection API.
 */
const DEEPFAKE_API_KEY = process.env.DEEPFAKE_API_KEY;

/**
 * Model version identifier for mock implementation.
 */
const MOCK_MODEL_VERSION = 'deepfake-detector-mock-v1';

/**
 * Possible artifact types that could be detected in deepfakes.
 */
const POSSIBLE_ARTIFACTS = [
  'face_boundary_blur',
  'unnatural_skin_texture',
  'asymmetric_features',
  'inconsistent_lighting',
  'eye_reflection_mismatch',
  'hair_boundary_artifacts',
  'temporal_inconsistency',
  'compression_artifacts',
];

/**
 * Generates a deterministic random number from a seed string.
 */
function seededRandom(seed: string): number {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
}

/**
 * Generates mock analysis details based on image buffer.
 */
function generateMockAnalysisDetails(
  imageBuffer: Buffer,
  isDeepfake: boolean
): DeepfakeAnalysisDetails {
  const seed = crypto.createHash('sha256').update(imageBuffer).digest('hex');

  // Generate consistent random values based on image
  const facesDetected = Math.floor(seededRandom(seed + 'faces') * 3) + 1; // 1-3 faces
  const consistencyScore = isDeepfake
    ? 0.3 + seededRandom(seed + 'consistency') * 0.3 // 0.3-0.6 for deepfakes
    : 0.85 + seededRandom(seed + 'consistency') * 0.15; // 0.85-1.0 for real

  // Generate artifacts if deepfake
  const artifactsFound: string[] = [];
  if (isDeepfake) {
    const numArtifacts = Math.floor(seededRandom(seed + 'numArtifacts') * 3) + 1;
    for (let i = 0; i < numArtifacts; i++) {
      const artifactIndex = Math.floor(
        seededRandom(seed + 'artifact' + i) * POSSIBLE_ARTIFACTS.length
      );
      const artifact = POSSIBLE_ARTIFACTS[artifactIndex]!;
      if (!artifactsFound.includes(artifact)) {
        artifactsFound.push(artifact);
      }
    }
  }

  // Determine lighting analysis result
  const lightingRandom = seededRandom(seed + 'lighting');
  let lightingAnalysis: 'consistent' | 'inconsistent' | 'inconclusive';
  if (isDeepfake) {
    lightingAnalysis = lightingRandom < 0.6 ? 'inconsistent' : 'inconclusive';
  } else {
    lightingAnalysis = lightingRandom < 0.8 ? 'consistent' : 'inconclusive';
  }

  // Compression anomalies more likely in deepfakes
  const compressionAnomalies = isDeepfake
    ? seededRandom(seed + 'compression') < 0.7
    : seededRandom(seed + 'compression') < 0.1;

  return {
    facesDetected,
    artifactsFound,
    consistencyScore: Math.round(consistencyScore * 100) / 100,
    compressionAnomalies,
    lightingAnalysis,
    modelVersion: MOCK_MODEL_VERSION,
  };
}

/**
 * Deepfake detection service for analyzing images for synthetic manipulation.
 *
 * Uses a third-party deepfake detection API when configured,
 * otherwise falls back to mock results for development.
 */
class DeepfakeService {
  private static instance: DeepfakeService;
  private readonly isMockMode: boolean;

  private constructor() {
    this.isMockMode = !DEEPFAKE_API_KEY;

    if (this.isMockMode) {
      console.log('[DeepfakeService] Running in mock mode - DEEPFAKE_API_KEY not configured');
    } else {
      console.log('[DeepfakeService] Running with real deepfake detection API');
    }
  }

  /**
   * Gets the singleton instance of DeepfakeService.
   */
  public static getInstance(): DeepfakeService {
    if (!DeepfakeService.instance) {
      DeepfakeService.instance = new DeepfakeService();
    }
    return DeepfakeService.instance;
  }

  /**
   * Checks if the service is running in mock mode.
   */
  public isInMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Analyzes an image for deepfake manipulation.
   *
   * @param imageBuffer - The image data as a Buffer
   * @returns Promise resolving to analysis result with detection details
   */
  public async analyze(imageBuffer: Buffer): Promise<DeepfakeAnalysisResult> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer cannot be empty');
    }

    if (this.isMockMode) {
      return this.performMockAnalysis(imageBuffer);
    }

    return this.performRealAnalysis(imageBuffer);
  }

  /**
   * Performs mock deepfake analysis.
   * Returns isDeepfake=false 95% of the time.
   */
  private async performMockAnalysis(imageBuffer: Buffer): Promise<DeepfakeAnalysisResult> {
    const startTime = Date.now();

    // Simulate API latency (300-800ms for analysis)
    const delay = Math.floor(Math.random() * 500) + 300;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Use buffer hash to determine if we should flag as deepfake
    // This makes results deterministic per image for testing
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const deepfakeProbability = seededRandom(hash + 'deepfake');

    // 5% chance of being a deepfake
    const isDeepfake = deepfakeProbability < 0.05;

    // Generate confidence score
    let confidence: number;
    if (isDeepfake) {
      // High confidence when flagging as deepfake (0.75-0.95)
      confidence = 0.75 + seededRandom(hash + 'confidence') * 0.2;
    } else {
      // High confidence when flagging as real (0.90-0.99)
      confidence = 0.90 + seededRandom(hash + 'confidence') * 0.09;
    }

    const analysisDetails = generateMockAnalysisDetails(imageBuffer, isDeepfake);
    const processingTimeMs = Date.now() - startTime;

    return {
      isDeepfake,
      confidence: Math.round(confidence * 100) / 100,
      analysisDetails,
      processingTimeMs,
    };
  }

  /**
   * Performs real deepfake analysis using configured API.
   * TODO: Implement actual API call when ready.
   */
  private async performRealAnalysis(imageBuffer: Buffer): Promise<DeepfakeAnalysisResult> {
    const startTime = Date.now();

    // TODO: Implement actual deepfake detection API call
    console.warn('[DeepfakeService] Real deepfake API not yet implemented, using mock');

    // Fall back to mock for now
    const mockResult = await this.performMockAnalysis(imageBuffer);

    return {
      ...mockResult,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// Export singleton instance
export const deepfakeService = DeepfakeService.getInstance();

// Export class for testing purposes
export { DeepfakeService };
