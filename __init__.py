"""
ComfyUI-NunchakuFluxLoraStacker

A standalone ComfyUI custom node for Nunchaku FLUX LoRA Stacking with dynamic UI control.
This node allows applying multiple LoRAs to Nunchaku FLUX models with a clean, efficient interface.

Features:
- Dynamic UI control based on lora_count and input_mode
- Support for up to 10 LoRAs simultaneously
- Simple and Advanced input modes
- Automatic node height adjustment
- Compatible with Nunchaku FLUX models

Author: Custom Implementation
License: Apache-2.0
"""

import logging
import os

# Version information
__version__ = "1.0.0"

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Import the LoRA Stack node
from .nodes.lora.flux import NunchakuFluxLoraStack

# Node class mappings
NODE_CLASS_MAPPINGS = {
    "FluxLoraMultiLoader": NunchakuFluxLoraStack,
}

# Add version to all node classes for ComfyUI Manager
for node_class in NODE_CLASS_MAPPINGS.values():
    node_class.__version__ = __version__

# Node display name mappings
NODE_DISPLAY_NAME_MAPPINGS = {
    "FluxLoraMultiLoader": "FLUX LoRA Multi Loader"
}

# Register JavaScript extensions
WEB_DIRECTORY = "js"

# Make version available at module level for ComfyUI Manager
VERSION = __version__

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "__version__", "VERSION"]

logger.info("=" * (80 + len(" ComfyUI-NunchakuFluxLoraStacker Initialization ")))
logger.info("ComfyUI-NunchakuFluxLoraStacker: Loading Nunchaku FLUX LoRA Stacker nodes...")
logger.info(f"ComfyUI-NunchakuFluxLoraStacker: Loaded {len(NODE_CLASS_MAPPINGS)} nodes")
logger.info("ComfyUI-NunchakuFluxLoraStacker: JavaScript directory: " + WEB_DIRECTORY)
logger.info("=" * (80 + len(" ComfyUI-NunchakuFluxLoraStacker Initialization ")))
