/**
 * Alert Creator Utility
 *
 * Creates user-friendly alerts from detected threats.
 * Follows Vara's design philosophy: "Emotional Clarity, Not Panic"
 */

import type { Prisma, AlertType, AlertSeverity, ImageMatchType } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma';

/**
 * Confidence tier for image matches.
 * Set by the image scan worker based on match quality.
 */
export type ConfidenceTier = 'HIGH' | 'MEDIUM_HIGH' | 'MEDIUM' | 'LOW';

/**
 * Face verification status from the scan worker.
 */
export type FaceVerificationStatus = 'VERIFIED' | 'NO_FACE_DETECTED' | 'MISMATCH';

/**
 * Represents an image match detected during scanning.
 */
export interface ImageMatch {
  id: string;
  protectedImageId: string;
  sourceUrl: string;
  platform?: string | null;
  similarity: number;
  matchType: ImageMatchType;
  isMock?: boolean; // Indicates this is test data
  confidence?: ConfidenceTier; // Overall confidence tier from scan worker
  faceVerified?: FaceVerificationStatus; // Face verification status
  faceSimilarity?: number; // Face similarity score (0.0-1.0)
  faceConfidence?: 'high' | 'medium' | 'low'; // Confidence of face match
}

/**
 * Result from deepfake analysis.
 */
export interface DeepfakeAnalysisResult {
  isDeepfake: boolean;
  confidence: number;
  analysisMethod: string;
  details?: Record<string, unknown>;
}

/**
 * Metadata stored with image-related alerts.
 */
interface ImageAlertMetadata {
  matchId: string;
  imageId: string;
  sourceUrl: string;
  similarity: number;
  matchType: ImageMatchType;
  platform?: string | null;
  deepfakeConfidence?: number;
  analysisMethod?: string;
  isMock?: boolean; // Indicates this is test/demo data
  confidence?: ConfidenceTier; // Overall confidence tier
  faceVerified?: FaceVerificationStatus; // Face verification status
  faceSimilarity?: number; // Face similarity score
  faceConfidence?: 'high' | 'medium' | 'low'; // Confidence of face match
}

/**
 * Determines the alert type based on the match type, deepfake analysis, and face verification.
 */
function determineAlertType(
  matchType: ImageMatchType,
  deepfakeAnalysis?: DeepfakeAnalysisResult,
  faceVerified?: FaceVerificationStatus
): AlertType {
  // Deepfake takes priority if detected
  if (deepfakeAnalysis?.isDeepfake && deepfakeAnalysis.confidence > 0.7) {
    return 'DEEPFAKE_DETECTED';
  }

  // Face-verified matches are higher confidence identity matches
  if (faceVerified === 'VERIFIED') {
    return 'FACE_MATCH';
  }

  // Otherwise, classify based on match type
  switch (matchType) {
    case 'DEEPFAKE':
      return 'DEEPFAKE_DETECTED';
    case 'EXACT':
    case 'SIMILAR':
    case 'MODIFIED':
    default:
      return 'IMAGE_MISUSE';
  }
}

/**
 * Determines alert severity based on match characteristics.
 *
 * Severity mapping based on confidence tiers from scan worker:
 * - HIGH confidence: CRITICAL - Exact match found online, immediate action needed
 * - MEDIUM_HIGH confidence: HIGH if face verified, MEDIUM otherwise
 * - MEDIUM confidence: MEDIUM - Moderate confidence match
 * - LOW confidence: LOW - May need manual review
 *
 * Deepfake detection takes priority over confidence tiers.
 */
function determineSeverity(
  matchType: ImageMatchType,
  similarity: number,
  deepfakeAnalysis?: DeepfakeAnalysisResult,
  faceVerified?: FaceVerificationStatus,
  faceConfidence?: 'high' | 'medium' | 'low',
  confidence?: ConfidenceTier
): AlertSeverity {
  // Deepfake detection takes priority
  if (deepfakeAnalysis?.isDeepfake) {
    if (deepfakeAnalysis.confidence >= 0.9) {
      return 'CRITICAL';
    }
    if (deepfakeAnalysis.confidence >= 0.7) {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  // Use confidence tier as primary driver if available
  if (confidence) {
    switch (confidence) {
      case 'HIGH':
        // Full matching images (exact match found online)
        return 'CRITICAL';

      case 'MEDIUM_HIGH':
        // Partial matches - higher if face was verified
        return faceVerified === 'VERIFIED' ? 'HIGH' : 'MEDIUM';

      case 'MEDIUM':
        return 'MEDIUM';

      case 'LOW':
        // Low confidence (visuallySimilarImages that passed all filters)
        return 'LOW';
    }
  }

  // Fallback to legacy logic for backward compatibility
  // Face-verified matches are high severity - confirmed identity match
  if (faceVerified === 'VERIFIED') {
    if (faceConfidence === 'high') {
      return 'CRITICAL';
    }
    if (faceConfidence === 'medium') {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  // Match type based severity (legacy fallback)
  switch (matchType) {
    case 'DEEPFAKE':
      return 'CRITICAL';

    case 'EXACT':
      // Exact matches are always concerning
      if (similarity >= 0.95) {
        return 'HIGH';
      }
      return 'MEDIUM';

    case 'MODIFIED':
      // Modified images suggest intentional manipulation
      if (similarity >= 0.8) {
        return 'HIGH';
      }
      return 'MEDIUM';

    case 'SIMILAR':
      // Similar images may or may not be concerning
      if (similarity >= 0.9) {
        return 'MEDIUM';
      }
      if (similarity >= 0.8) {
        return 'LOW';
      }
      return 'INFO';

    default:
      return 'INFO';
  }
}

/**
 * Generates a user-friendly alert title.
 * Following Vara's principle: calm, clear, non-technical language.
 */
function generateTitle(
  alertType: AlertType,
  matchType: ImageMatchType,
  platform?: string | null
): string {
  const platformText = platform ? ` on ${formatPlatformName(platform)}` : '';

  switch (alertType) {
    case 'DEEPFAKE_DETECTED':
      return `Potential AI-generated image found${platformText}`;

    case 'FACE_MATCH':
      return `Your face was detected in an image${platformText}`;

    case 'IMAGE_MISUSE':
      switch (matchType) {
        case 'EXACT':
          return `Your photo was found${platformText}`;
        case 'MODIFIED':
          return `A modified version of your photo was found${platformText}`;
        case 'SIMILAR':
          return `A similar image was found${platformText}`;
        default:
          return `Image match detected${platformText}`;
      }

    default:
      return `Image alert${platformText}`;
  }
}

/**
 * Generates a user-friendly alert description.
 * Explains what happened and why it matters in plain language.
 */
function generateDescription(
  alertType: AlertType,
  matchType: ImageMatchType,
  similarity: number,
  deepfakeAnalysis?: DeepfakeAnalysisResult,
  _faceVerified?: FaceVerificationStatus, // Used to determine alertType upstream
  faceSimilarity?: number,
  faceConfidence?: 'high' | 'medium' | 'low'
): string {
  const similarityPercent = Math.round(similarity * 100);

  if (alertType === 'DEEPFAKE_DETECTED') {
    const confidence = deepfakeAnalysis?.confidence
      ? Math.round(deepfakeAnalysis.confidence * 100)
      : similarityPercent;

    return (
      `Our AI detection system identified a potential deepfake or AI-generated image ` +
      `based on one of your protected photos. The analysis shows ${confidence}% confidence ` +
      `that this image was artificially created or manipulated. ` +
      `We recommend reviewing this finding and taking action if needed.`
    );
  }

  if (alertType === 'FACE_MATCH') {
    const facePercent = faceSimilarity ? Math.round(faceSimilarity * 100) : similarityPercent;
    const confidenceText =
      faceConfidence === 'high'
        ? 'with high confidence'
        : faceConfidence === 'medium'
          ? 'with moderate confidence'
          : 'with some uncertainty';

    return (
      `Our facial recognition system detected your face in an image found online ` +
      `${confidenceText} (${facePercent}% facial match). ` +
      `This means an image containing your likeness may be in use without your knowledge. ` +
      `We recommend reviewing this match and taking action if this use is unauthorized.`
    );
  }

  switch (matchType) {
    case 'EXACT':
      return (
        `We found what appears to be your exact photo being used elsewhere online. ` +
        `The image matches ${similarityPercent}% with your protected photo. ` +
        `This could indicate unauthorized use of your image.`
      );

    case 'MODIFIED':
      return (
        `We detected a modified version of your photo online. ` +
        `Someone may have edited, cropped, or altered your image before posting it. ` +
        `The similarity to your original is ${similarityPercent}%.`
      );

    case 'SIMILAR':
      return (
        `We found an image that closely resembles one of your protected photos ` +
        `(${similarityPercent}% similarity). This could be a coincidence, ` +
        `or it might be worth investigating further.`
      );

    default:
      return (
        `An image match was detected with ${similarityPercent}% similarity ` +
        `to one of your protected photos.`
      );
  }
}

/**
 * Formats platform names for user-friendly display.
 */
function formatPlatformName(platform: string): string {
  const platformMap: Record<string, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    facebook: 'Facebook',
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    reddit: 'Reddit',
    pinterest: 'Pinterest',
    tumblr: 'Tumblr',
  };

  return platformMap[platform.toLowerCase()] || platform;
}

/**
 * Creates an alert from an image match detection.
 *
 * This function:
 * 1. Determines the appropriate alert type (DEEPFAKE_DETECTED, FACE_MATCH, or IMAGE_MISUSE)
 * 2. Calculates severity based on match characteristics
 * 3. Generates user-friendly title and description
 * 4. Stores all relevant metadata for later reference
 *
 * @param userId - The user who owns the protected image
 * @param match - The detected image match
 * @param deepfakeAnalysis - Optional deepfake analysis results
 *
 * @example
 * ```typescript
 * await createAlertFromMatch(userId, {
 *   id: 'match-123',
 *   protectedImageId: 'img-456',
 *   sourceUrl: 'https://example.com/stolen-image.jpg',
 *   platform: 'instagram',
 *   similarity: 0.92,
 *   matchType: 'EXACT',
 *   confidence: 'HIGH',
 *   faceVerified: 'VERIFIED',
 *   faceSimilarity: 0.95,
 *   faceConfidence: 'high'
 * });
 * ```
 */
export async function createAlertFromMatch(
  userId: string,
  match: ImageMatch,
  deepfakeAnalysis?: DeepfakeAnalysisResult
): Promise<void> {
  const alertType = determineAlertType(match.matchType, deepfakeAnalysis, match.faceVerified);
  const severity = determineSeverity(
    match.matchType,
    match.similarity,
    deepfakeAnalysis,
    match.faceVerified,
    match.faceConfidence,
    match.confidence
  );
  const title = generateTitle(alertType, match.matchType, match.platform);
  const description = generateDescription(
    alertType,
    match.matchType,
    match.similarity,
    deepfakeAnalysis,
    match.faceVerified,
    match.faceSimilarity,
    match.faceConfidence
  );

  const metadata: ImageAlertMetadata = {
    matchId: match.id,
    imageId: match.protectedImageId,
    sourceUrl: match.sourceUrl,
    similarity: match.similarity,
    matchType: match.matchType,
    platform: match.platform,
    isMock: match.isMock,
    confidence: match.confidence,
  };

  // Add deepfake-specific metadata if present
  if (deepfakeAnalysis) {
    metadata.deepfakeConfidence = deepfakeAnalysis.confidence;
    metadata.analysisMethod = deepfakeAnalysis.analysisMethod;
  }

  // Add face verification metadata if present
  if (match.faceVerified !== undefined) {
    metadata.faceVerified = match.faceVerified;
    metadata.faceSimilarity = match.faceSimilarity;
    metadata.faceConfidence = match.faceConfidence;
  }

  try {
    await prisma.alert.create({
      data: {
        userId,
        type: alertType,
        severity,
        title,
        description,
        metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
        status: 'NEW',
      },
    });

    console.log(
      `[AlertCreator] Created ${severity} ${alertType} alert for user ${userId}`
    );
  } catch (error) {
    console.error('[AlertCreator] Failed to create alert:', error);
    throw error;
  }
}

/**
 * Metadata for data breach alerts.
 */
interface BreachAlertMetadata {
  breachName: string;
  breachDate: string;
  affectedEmail: string;
  dataTypes: string[];
  source: string;
}

/**
 * Creates an alert from a data breach detection.
 *
 * @param userId - The user whose email was found in a breach
 * @param breachInfo - Information about the detected breach
 */
export async function createBreachAlert(
  userId: string,
  breachInfo: {
    breachName: string;
    breachDate: string;
    affectedEmail: string;
    dataTypes: string[];
    source?: string;
  }
): Promise<void> {
  const dataTypesText = breachInfo.dataTypes.slice(0, 3).join(', ');
  const additionalTypes =
    breachInfo.dataTypes.length > 3
      ? ` and ${breachInfo.dataTypes.length - 3} more`
      : '';

  const title = `Your email was found in the ${breachInfo.breachName} data breach`;

  const description =
    `Your email address (${maskEmail(breachInfo.affectedEmail)}) was found in a known data breach ` +
    `from ${formatBreachDate(breachInfo.breachDate)}. ` +
    `This breach exposed: ${dataTypesText}${additionalTypes}. ` +
    `We recommend changing your password and enabling two-factor authentication.`;

  const metadata: BreachAlertMetadata = {
    breachName: breachInfo.breachName,
    breachDate: breachInfo.breachDate,
    affectedEmail: breachInfo.affectedEmail,
    dataTypes: breachInfo.dataTypes,
    source: breachInfo.source || 'haveibeenpwned',
  };

  // Determine severity based on data types exposed
  const sensitiveTypes = ['passwords', 'credit cards', 'ssn', 'bank accounts'];
  const hasSensitiveData = breachInfo.dataTypes.some((type) =>
    sensitiveTypes.some((sensitive) => type.toLowerCase().includes(sensitive))
  );

  const severity: AlertSeverity = hasSensitiveData ? 'HIGH' : 'MEDIUM';

  try {
    await prisma.alert.create({
      data: {
        userId,
        type: 'DATA_BREACH',
        severity,
        title,
        description,
        metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
        status: 'NEW',
      },
    });

    console.log(
      `[AlertCreator] Created DATA_BREACH alert for user ${userId}: ${breachInfo.breachName}`
    );
  } catch (error) {
    console.error('[AlertCreator] Failed to create breach alert:', error);
    throw error;
  }
}

/**
 * Masks an email address for privacy in display.
 * Example: "user@example.com" -> "u***@e***.com"
 */
function maskEmail(email: string): string {
  const parts = email.split('@');
  const local = parts[0];
  const domain = parts[1];

  if (!local || !domain) return email;

  const domainParts = domain.split('.');
  const domainName = domainParts[0];
  const tld = domainParts.slice(1);

  if (!domainName) return email;

  const maskedLocal = local.charAt(0) + '***';
  const maskedDomain = domainName.charAt(0) + '***';

  return `${maskedLocal}@${maskedDomain}.${tld.join('.')}`;
}

/**
 * Formats a breach date for user-friendly display.
 */
function formatBreachDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  } catch {
    return dateStr;
  }
}
