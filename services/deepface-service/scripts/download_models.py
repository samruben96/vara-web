#!/usr/bin/env python3
"""
Pre-download model weights during Docker build.

This script downloads:
1. ArcFace model weights for face recognition (~500MB)
2. CLIP model weights for image embeddings (~400MB)

so they are cached in the Docker image and don't need to be downloaded
at runtime.
"""

import os
import sys


def download_arcface_model():
    """Download ArcFace model weights."""
    print("Downloading ArcFace model weights...")

    # Import deepface - this will set up the weights directory
    from deepface import DeepFace

    # Create a dummy image for model initialization
    # DeepFace downloads models on first use, so we trigger that here
    import numpy as np

    # Create a simple test image (224x224 RGB)
    dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
    dummy_img[100:124, 100:124] = 255  # Add a white square as a "face"

    try:
        # This will trigger model download
        # We use enforce_detection=False since our dummy image has no real face
        DeepFace.represent(
            img_path=dummy_img,
            model_name="ArcFace",
            enforce_detection=False,
            detector_backend="skip"
        )
        print("ArcFace model downloaded successfully!")
    except Exception as e:
        # Some errors are expected with dummy data, but model should be downloaded
        print(f"Model initialization completed (expected warning: {e})")

    # Verify model files exist
    weights_dir = os.path.expanduser("~/.deepface/weights")
    if os.path.exists(weights_dir):
        print(f"Weights directory contents: {os.listdir(weights_dir)}")

        # Check for ArcFace weights
        arcface_files = [f for f in os.listdir(weights_dir) if "arcface" in f.lower()]
        if arcface_files:
            print(f"ArcFace model files found: {arcface_files}")
            return True
        else:
            print("WARNING: ArcFace model files not found!")
            return False
    else:
        print(f"ERROR: Weights directory not found at {weights_dir}")
        return False


def download_clip_model():
    """Download CLIP model weights."""
    print("\nDownloading CLIP model weights...")

    try:
        from sentence_transformers import SentenceTransformer
        from PIL import Image
        import numpy as np

        # This will download the CLIP model (~400MB)
        model = SentenceTransformer('clip-ViT-B-32')
        print("CLIP model downloaded successfully!")

        # Test the model with a dummy image
        dummy_img = Image.new("RGB", (224, 224), color=(128, 128, 128))
        embedding = model.encode(dummy_img)

        if embedding is not None and len(embedding) == 512:
            print(f"CLIP model test successful! Embedding shape: {embedding.shape}")
            return True
        else:
            print("WARNING: CLIP model test returned unexpected embedding")
            return False

    except Exception as e:
        print(f"ERROR: Failed to download CLIP model: {e}")
        return False


def main():
    """Main entry point."""
    print("=" * 60)
    print("Model Pre-Download Script")
    print("=" * 60)

    arcface_success = download_arcface_model()

    # Skip CLIP preloading during Docker build to avoid memory issues
    # CLIP model will be downloaded lazily on first request
    # This adds ~30s to first CLIP request but avoids build failures
    skip_clip = os.environ.get("SKIP_CLIP_PRELOAD", "true").lower() == "true"

    if skip_clip:
        print("\nSkipping CLIP model preload (will download on first request)")
        print("Set SKIP_CLIP_PRELOAD=false to preload during build")
        clip_success = True  # Not a failure, just deferred
    else:
        clip_success = download_clip_model()

    print("\n" + "=" * 60)
    print("Summary:")
    print(f"  - ArcFace: {'OK' if arcface_success else 'FAILED'}")
    print(f"  - CLIP: {'SKIPPED (lazy load)' if skip_clip else ('OK' if clip_success else 'FAILED')}")
    print("=" * 60)

    if arcface_success:
        print("Essential models ready!")
        sys.exit(0)
    else:
        print("ArcFace model failed - check logs above")
        sys.exit(1)


if __name__ == "__main__":
    main()
