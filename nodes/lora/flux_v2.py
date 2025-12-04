"""
This module dynamically generates V2 nodes with fixed LoRA slot counts (1 to 10) for ComfyUI Beta 2.0 (Desktop).
No JavaScript required.
"""

import logging
import os
import folder_paths
import sys

custom_node_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if custom_node_dir not in sys.path:
    sys.path.insert(0, custom_node_dir)

from wrappers.flux import ComfyFluxWrapper

log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO), format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

class FluxLoraMultiLoaderBase:
    """Base class for fixed-slot LoRA loaders."""
    
    _slot_count = 0

    @classmethod
    def INPUT_TYPES(cls):
        loras = ["None"] + folder_paths.get_filename_list("loras")
        
        inputs = {
            "required": {
                "model": ("MODEL", {"tooltip": "The diffusion model loaded by Nunchaku FLUX DiT Loader."}),
            },
            "optional": {},
        }

        for i in range(1, cls._slot_count + 1):
            inputs["optional"][f"lora_name_{i}"] = (loras, {"tooltip": f"LoRA {i} filename"})
            # Restored step to 0.001 to allow decimals, kept min/max removed to avoid slider interference
            inputs["optional"][f"lora_wt_{i}"] = ("FLOAT", {"default": 1.0, "step": 0.001, "tooltip": f"LoRA {i} Strength"})
            
            # Restored code as commented out blocks as requested
            # inputs["required"][f"model_str_{i}"] = ("FLOAT", {"default": 1.0, "min": -100.0, "max": 100.0, "step": 0.01, "tooltip": f"LoRA {i} Model Strength"})
            # inputs["required"][f"clip_str_{i}"] = ("FLOAT", {"default": 1.0, "min": -100.0, "max": 100.0, "step": 0.01, "tooltip": f"LoRA {i} Clip Strength"})

        return inputs

    RETURN_TYPES = ("MODEL",)
    OUTPUT_TOOLTIPS = ("The modified diffusion model.",)
    FUNCTION = "load_lora_stack"
    CATEGORY = "FLUX/MultiLoader" 

    def load_lora_stack(self, model, **kwargs):
        loras_to_apply = []
        for i in range(1, self._slot_count + 1):
            lora_name = kwargs.get(f"lora_name_{i}")
            if not lora_name or lora_name == "None": continue
            
            lora_wt = kwargs.get(f"lora_wt_{i}", 1.0)
            
            # model_str = kwargs.get(f"model_str_{i}", 1.0)
            # clip_str = kwargs.get(f"clip_str_{i}", 1.0)
            
            # If model_str/clip_str logic is needed in future, uncomment above and adjust strength logic
            # strength = model_str # Example logic
            
            strength = lora_wt
            
            if abs(strength) < 1e-5: continue
            loras_to_apply.append((lora_name, strength))

        # Deduplicate
        loras_formatted = []
        seen = set()
        for name, strength in loras_to_apply:
            if name not in seen:
                loras_formatted.append((name, strength))
                seen.add(name)

        model_wrapper = model.model.diffusion_model
        actual_wrapper = model_wrapper._orig_mod if hasattr(model_wrapper, "_orig_mod") else model_wrapper
        wrapper_class = type(actual_wrapper).__name__

        if wrapper_class == "ComfyFluxWrapper":
            actual_wrapper.loras = []
            for name, strength in loras_formatted:
                path = folder_paths.get_full_path_or_raise("loras", name)
                actual_wrapper.loras.append((path, strength))
        elif wrapper_class == "NunchakuFluxTransformer2dModel":
            if loras_formatted:
                from nunchaku.lora.flux.compose import compose_lora
                tuples = [(folder_paths.get_full_path_or_raise("loras", n), s) for n, s in loras_formatted]
                if len(tuples) == 1:
                    actual_wrapper.update_lora_params(tuples[0][0])
                    actual_wrapper.set_lora_strength(tuples[0][1])
                else:
                    actual_wrapper.update_lora_params(compose_lora(tuples))
            else:
                actual_wrapper.update_lora_params(None)
        
        return (model,)

GENERATED_NODES = {}
GENERATED_DISPLAY_NAMES = {}

# Generate nodes for 1 to 10 slots
for i in range(1, 11):
    class_name = f"FluxLoraMultiLoader_{i}"
    # FluxLoraMultiLoader_10 gets special V2 name, others keep x{i} format
    if i == 10:
        title = "FLUX LoRA Loader V2"
        display_name = "FLUX LoRA Loader V2"
    else:
        title = f"FLUX LoRA Loader (x{i})"
        display_name = f"FLUX LoRA Loader (x{i})"
    
    node_class = type(class_name, (FluxLoraMultiLoaderBase,), {
        "_slot_count": i,
        "TITLE": title,
        "DESCRIPTION": f"Load up to {i} LoRAs."
    })
    
    GENERATED_NODES[class_name] = node_class
    GENERATED_DISPLAY_NAMES[class_name] = display_name
