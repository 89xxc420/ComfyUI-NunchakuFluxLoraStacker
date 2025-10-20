"""
This module provides the :class:`NunchakuFluxLoraStack` node
for applying multiple LoRA weights to Nunchaku FLUX models within ComfyUI.

This is a standalone implementation with dynamic UI control.
"""

import logging
import os

import folder_paths

from nunchaku.lora.flux import to_diffusers

import sys
import os

# Add the custom node directory to the path
custom_node_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if custom_node_dir not in sys.path:
    sys.path.insert(0, custom_node_dir)

from wrappers.flux import ComfyFluxWrapper

# Get log level from environment variable (default to INFO)
log_level = os.getenv("LOG_LEVEL", "INFO").upper()

# Configure logging
logging.basicConfig(level=getattr(logging, log_level, logging.INFO), format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class NunchakuFluxLoraStack:
    """
    Node for loading and applying multiple LoRAs to a Nunchaku FLUX model with dynamic input.

    This node allows you to configure multiple LoRAs with their respective strengths
    in a single node, providing the same effect as chaining multiple LoRA nodes.
    Based on efficiency-nodes-comfyui implementation with dynamic LoRA count.

    Attributes
    ----------
    RETURN_TYPES : tuple
        The return type of the node ("MODEL",).
    OUTPUT_TOOLTIPS : tuple
        Tooltip for the output.
    FUNCTION : str
        The function to call ("load_lora_stack").
    TITLE : str
        Node title.
    CATEGORY : str
        Node category.
    DESCRIPTION : str
        Node description.
    """

    @classmethod
    def INPUT_TYPES(s):
        """
        Defines the input types for the LoRA stack node with dynamic LoRA count.

        Returns
        -------
        dict
            A dictionary specifying the required inputs and optional LoRA inputs.
        """
        loras = ["None"] + folder_paths.get_filename_list("loras")
        
        # Base inputs
        inputs = {
            "required": {
                "model": (
                    "MODEL",
                    {
                        "tooltip": "The diffusion model the LoRAs will be applied to. "
                        "Make sure the model is loaded by `Nunchaku FLUX DiT Loader`."
                    },
                ),
                "input_mode": (
                    ["simple", "advanced"],
                    {
                        "default": "simple",
                        "tooltip": "Input mode: 'simple' shows only LoRA name and weight, 'advanced' shows separate model and clip strengths."
                    },
                ),
                "lora_count": (
                    "INT",
                    {
                        "default": 3,
                        "min": 1,
                        "max": 10,
                        "step": 1,
                        "tooltip": "Number of LoRA slots to process. Adjust this to control how many LoRAs are applied.",
                    },
                ),
            },
            "optional": {},
        }

        # Add all LoRA inputs (up to 10 slots) - exactly like efficiency-nodes-comfyui
        for i in range(1, 11):  # Support up to 10 LoRAs
            inputs["required"][f"lora_name_{i}"] = (
                loras,
                {"tooltip": f"The file name of LoRA {i}. Select 'None' to skip this slot."},
            )
            inputs["required"][f"lora_wt_{i}"] = (
                "FLOAT",
                {
                    "default": 1.0,
                    "min": -100.0,
                    "max": 100.0,
                    "step": 0.01,
                    "tooltip": f"Overall strength for LoRA {i} (simple mode). This value can be negative.",
                },
            )
            inputs["required"][f"model_str_{i}"] = (
                "FLOAT",
                {
                    "default": 1.0,
                    "min": -100.0,
                    "max": 100.0,
                    "step": 0.01,
                    "tooltip": f"Model strength for LoRA {i} (advanced mode). This value can be negative.",
                },
            )
            inputs["required"][f"clip_str_{i}"] = (
                "FLOAT",
                {
                    "default": 1.0,
                    "min": -100.0,
                    "max": 100.0,
                    "step": 0.01,
                    "tooltip": f"CLIP strength for LoRA {i} (advanced mode). This value can be negative.",
                },
            )

        return inputs

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Force re-evaluation when lora_count changes
        return float("nan")

    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs):
        # This method is called to validate inputs and can be used for dynamic UI
        return True

    RETURN_TYPES = ("MODEL",)
    OUTPUT_TOOLTIPS = ("The modified diffusion model with all LoRAs applied.",)
    FUNCTION = "load_lora_stack"
    TITLE = "FLUX LoRA Multi Loader"

    CATEGORY = "FLUX"
    DESCRIPTION = (
        "Apply multiple LoRAs to a diffusion model in a single node. "
        "Equivalent to chaining multiple LoRA nodes but more convenient for managing many LoRAs. "
        "Supports up to 10 LoRAs simultaneously. Use 'lora_count' to control how many LoRAs are processed. "
        "Set unused slots to 'None' to skip them."
    )

    def load_lora_stack(self, model, input_mode="simple", lora_count=3, **kwargs):
        """
        Apply multiple LoRAs to a Nunchaku FLUX diffusion model.

        Parameters
        ----------
        model : object
            The diffusion model to modify.
        lora_count : int
            Number of LoRA slots to process (1-10).
        **kwargs
            Dynamic LoRA name and strength parameters.

        Returns
        -------
        tuple
            A tuple containing the modified diffusion model.
        """
        # Collect LoRA information to apply
        loras_to_apply = []

        # Only check the number of LoRA slots specified by lora_count
        for i in range(1, min(lora_count + 1, 11)):  # Check up to lora_count slots, max 10
            lora_name = kwargs.get(f"lora_name_{i}")

            # Skip unset or None LoRAs
            if lora_name is None or lora_name == "None" or lora_name == "":
                continue

            # Get strength based on input_mode
            if input_mode == "simple":
                lora_strength = kwargs.get(f"lora_wt_{i}", 1.0)
            else:  # advanced mode
                model_strength = kwargs.get(f"model_str_{i}", 1.0)
                clip_strength = kwargs.get(f"clip_str_{i}", 1.0)
                # For now, use model_strength as the main strength
                # In a full implementation, you might want to handle model and clip separately
                lora_strength = model_strength

            # Skip LoRAs with zero strength
            if abs(lora_strength) < 1e-5:
                continue

            loras_to_apply.append((lora_name, lora_strength))

        # If no LoRAs need to be applied, return the original model
        if not loras_to_apply:
            return (model,)

        model_wrapper = model.model.diffusion_model
        
        # Check if it's a ComfyFluxWrapper (from either our wrapper or the original nunchaku wrapper)
        # Handle torch.compile() optimized modules
        if hasattr(model_wrapper, '_orig_mod'):
            # This is a torch._dynamo.eval_frame.OptimizedModule
            actual_wrapper = model_wrapper._orig_mod
            wrapper_class_name = type(actual_wrapper).__name__
            if wrapper_class_name != 'ComfyFluxWrapper':
                raise ValueError(f"Model structure not recognized. Expected ComfyFluxWrapper, got {type(actual_wrapper)} (wrapped in OptimizedModule)")
            print(f"DEBUG: Using {wrapper_class_name} from {type(actual_wrapper).__module__} (wrapped in OptimizedModule)")
        else:
            wrapper_class_name = type(model_wrapper).__name__
            if wrapper_class_name != 'ComfyFluxWrapper':
                raise ValueError(f"Model structure not recognized. Expected ComfyFluxWrapper, got {type(model_wrapper)}")
            print(f"DEBUG: Using {wrapper_class_name} from {type(model_wrapper).__module__}")

        # Get transformer from the correct location (handle OptimizedModule)
        if hasattr(model_wrapper, '_orig_mod'):
            # This is an OptimizedModule - we need to avoid deepcopy completely
            transformer = model_wrapper._orig_mod.model
            # Create a new model structure manually for OptimizedModule
            # We can't use deepcopy due to QuantizedFluxModel, so create a new model instance
            # Create a new ModelPatcher with the same parameters as the original
            ret_model = model.__class__(model.model, model.load_device, model.offload_device, model.size, model.weight_inplace_update)
            ret_model.model = model.model
            # For OptimizedModule, we need to create a new ComfyFluxWrapper manually
            # Create a new ComfyFluxWrapper with the same parameters as the original
            original_wrapper = model_wrapper._orig_mod
            ret_model_wrapper = ComfyFluxWrapper(
                transformer, 
                original_wrapper.config,
                original_wrapper.pulid_pipeline,
                original_wrapper.customized_forward,
                original_wrapper.forward_kwargs
            )
            # Copy internal state from original wrapper
            ret_model_wrapper._prev_timestep = original_wrapper._prev_timestep
            ret_model_wrapper._cache_context = original_wrapper._cache_context
            if hasattr(original_wrapper, '_original_time_text_embed'):
                ret_model_wrapper._original_time_text_embed = original_wrapper._original_time_text_embed
            ret_model.model.diffusion_model = ret_model_wrapper
        else:
            transformer = model_wrapper.model
            model_wrapper.model = None
            # We can't use deepcopy due to QuantizedFluxModel, so create a new model instance
            # Create a new ModelPatcher with the same parameters as the original
            ret_model = model.__class__(model.model, model.load_device, model.offload_device, model.size, model.weight_inplace_update)
            # Create a new ComfyFluxWrapper manually for non-OptimizedModule case too
            original_wrapper = model_wrapper
            ret_model_wrapper = ComfyFluxWrapper(
                transformer, 
                original_wrapper.config,
                original_wrapper.pulid_pipeline,
                original_wrapper.customized_forward,
                original_wrapper.forward_kwargs
            )
            # Copy internal state from original wrapper
            ret_model_wrapper._prev_timestep = original_wrapper._prev_timestep
            ret_model_wrapper._cache_context = original_wrapper._cache_context
            if hasattr(original_wrapper, '_original_time_text_embed'):
                ret_model_wrapper._original_time_text_embed = original_wrapper._original_time_text_embed
            ret_model.model.diffusion_model = ret_model_wrapper
        
        # Check if it's a ComfyFluxWrapper (from either our wrapper or the original nunchaku wrapper)
        ret_wrapper_class_name = type(ret_model_wrapper).__name__
        if ret_wrapper_class_name != 'ComfyFluxWrapper':
            raise ValueError(f"Ret model structure not recognized. Expected ComfyFluxWrapper, got {type(ret_model_wrapper)}")
        
        print(f"DEBUG: Using {ret_wrapper_class_name} from {type(ret_model_wrapper).__module__}")

        # Restore transformer to the original wrapper (important for original model integrity)
        if hasattr(model_wrapper, '_orig_mod'):
            model_wrapper._orig_mod.model = transformer
        else:
            model_wrapper.model = transformer
        
        # Set transformer to the new wrapper (maintain original code structure)
        ret_model_wrapper.model = transformer

        # Clear existing LoRA list
        ret_model_wrapper.loras = []

        # Track the maximum input channels needed
        max_in_channels = ret_model.model.model_config.unet_config["in_channels"]

        # Add all LoRAs
        for lora_name, lora_strength in loras_to_apply:
            lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)
            ret_model_wrapper.loras.append((lora_path, lora_strength))

            # Check if input channels need to be updated
            sd = to_diffusers(lora_path)
            if "transformer.x_embedder.lora_A.weight" in sd:
                new_in_channels = sd["transformer.x_embedder.lora_A.weight"].shape[1]
                assert new_in_channels % 4 == 0
                new_in_channels = new_in_channels // 4
                max_in_channels = max(max_in_channels, new_in_channels)

        # Update the model's input channels
        if max_in_channels > ret_model.model.model_config.unet_config["in_channels"]:
            ret_model.model.model_config.unet_config["in_channels"] = max_in_channels

        return (ret_model,)
