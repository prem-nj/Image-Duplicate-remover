import imagehash
from PIL import Image
import logging
import os
from collections import defaultdict

logger = logging.getLogger(__name__)

def calculate_hash_distance(hash1, hash2):
    """Calculate normalized hamming distance between two image hashes"""
    try:
        # Convert string hashes back to imagehash objects
        h1 = imagehash.hex_to_hash(hash1)
        h2 = imagehash.hex_to_hash(hash2)

        # Calculate distance
        distance = abs(h1 - h2)
        logger.debug(f"Hash distance: {distance}")
        return distance
    except Exception as e:
        logger.error(f"Error calculating hash distance: {str(e)}")
        return float('inf')

def process_images(image_paths):
    """Process images to find duplicates using perceptual hashing"""
    if not image_paths:
        raise ValueError("No images provided")

    logger.debug(f"Processing {len(image_paths)} images")
    image_hashes = {}

    # Calculate hashes for all images
    for img_path in image_paths:
        try:
            if not os.path.exists(img_path):
                logger.warning(f"File not found: {img_path}")
                continue

            with Image.open(img_path) as img:
                # Convert to RGB if necessary
                if img.mode not in ('RGB', 'L'):
                    img = img.convert('RGB')
                
                # Use both difference hash and perceptual hash for better accuracy
                dhash_value = str(imagehash.dhash(img))
                phash_value = str(imagehash.phash(img))
                image_hashes[img_path] = {'dhash': dhash_value, 'phash': phash_value}

        except Exception as e:
            logger.error(f"Error processing image {img_path}: {e}")
            continue

    if not image_hashes:
        raise ValueError("No valid images could be processed")

    # Find duplicates using both hash types
    DHASH_THRESHOLD = 8
    PHASH_THRESHOLD = 12
    groups = []
    processed = set()

    for img_path, img_hashes in image_hashes.items():
        if img_path in processed:
            continue

        current_group = [img_path]
        processed.add(img_path)

        # Compare with other images
        for other_path, other_hashes in image_hashes.items():
            if other_path != img_path and other_path not in processed:
                dhash_distance = calculate_hash_distance(img_hashes['dhash'], other_hashes['dhash'])
                phash_distance = calculate_hash_distance(img_hashes['phash'], other_hashes['phash'])
                
                # Consider images duplicate if either hash is within threshold
                if dhash_distance <= DHASH_THRESHOLD or phash_distance <= PHASH_THRESHOLD:
                    processed.add(other_path)

        if len(current_group) > 1:  # Only add groups with duplicates
            groups.append(current_group)
        else:  # Single image, no duplicates
            groups.append([img_path])

    # Prepare results
    unique_images = []
    duplicate_groups = []
    total_duplicates = 0

    for group in groups:
        # Add first image of each group to unique images
        unique_images.append(os.path.basename(group[0]))

        # If there are duplicates in the group
        if len(group) > 1:
            duplicate_groups.append({
                'original': os.path.basename(group[0]),
                'duplicates': [os.path.basename(p) for p in group[1:]]
            })
            total_duplicates += len(group) - 1

    logger.debug(f"Found {len(unique_images)} unique images and {total_duplicates} duplicates")
    logger.debug(f"Duplicate groups: {duplicate_groups}")

    return {
        'unique_images': unique_images,
        'duplicate_groups': duplicate_groups,
        'total_duplicates': total_duplicates,
        'total_processed': len(image_paths)
    }