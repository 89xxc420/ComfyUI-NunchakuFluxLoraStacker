# ComfyUI-NunchakuFluxLoraStacker

An advanced LoRA stacker node specifically designed for Nunchaku FLUX models, featuring dynamic UI control for easy and efficient LoRA management.

## Overview

This project was developed to improve the usability of the standard FLUX LoRA Stacker included with [Nunchaku](https://github.com/nunchaku-tech/ComfyUI-nunchaku). It implements automatic height adjustment based on the number of LoRAs, similar to efficiency-nodes-comfyui and Power LoRA Loader, while being completely independent as a Custom Node.

By separating this functionality into an independent node, it remains stable and maintainable even when the main Nunchaku package is updated.

## Key Features

### Dynamic UI Control
- **Automatic adjustment based on LoRA count**: The number of visible LoRA slots automatically changes based on the `lora_count` parameter
- **Automatic node height adjustment**: Node height dynamically adjusts to fit the number of visible widgets
- **Real-time updates**: UI updates instantly when parameters are changed

### Two Input Modes
- **Simple Mode**: 
  - Shows only LoRA name and overall weight
  - Ideal for quick configuration
  
- **Advanced Mode**:
  - Allows separate control of Model and CLIP strengths
  - Use when fine-grained control is needed

### Support for up to 10 LoRAs Simultaneously
- Apply up to 10 LoRAs in a single node
- Unused slots can be skipped by selecting `None`
- Use `lora_count` to limit the number of processed LoRAs and optimize performance

### Optimized for Nunchaku
- **Quantized model support**: Fully compatible with Nunchaku's 4-bit quantized models
- **torch.compile() support**: Supports OptimizedModule
- **PuLID integration**: Maintains compatibility with PuLID pipeline
- **ControlNet support**: Works with ControlNet-Union-Pro 2.0 and others
- **First-Block Cache**: Supports Nunchaku's caching functionality

## Technical Features

### Hybrid Python + JavaScript Implementation
This node provides advanced functionality that cannot be achieved with Python alone:

1. **Python side (nodes/lora/flux.py)**:
   - LoRA application logic for Nunchaku FLUX models
   - Integration with ComfyFluxWrapper
   - LoRA composition processing
   - PuLID weight preservation and restoration
   - Automatic input_channels adjustment

2. **Wrapper (wrappers/flux.py)**:
   - Wrapper for NunchakuFluxTransformer2dModel
   - LoRA composition and model updates
   - Caching strategy implementation
   - PuLID and ControlNet support

3. **JavaScript side (js/widgethider.js)**:
   - Dynamic widget show/hide control
   - Automatic node height calculation and adjustment
   - efficiency-nodes-comfyui style UI control

## Installation

1. Clone into ComfyUI's `custom_nodes` directory:
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker.git
```

2. Install dependencies:
```bash
cd ComfyUI-NunchakuFluxLoraStacker
pip install -r requirements.txt
```

3. Restart ComfyUI

## Usage

### Basic Usage

1. Add a **FLUX LoRA Multi Loader** node to your workflow
2. Connect a Nunchaku FLUX model to the `model` input
3. Set `lora_count` to specify the number of LoRA slots to use (1-10)
4. Choose `input_mode`:
   - **simple**: Adjust only the overall strength
   - **advanced**: Adjust Model and CLIP separately
5. Select LoRA files for each slot and set their strengths
6. Connect the output to the next node

### Parameter Details

#### Required Inputs
- **model**: Nunchaku FLUX model (from `Nunchaku FLUX DiT Loader`)
- **input_mode**: Input mode (`simple` / `advanced`)
- **lora_count**: Number of LoRA slots to process (1-10)

#### LoRA Slots (per slot)
- **lora_name_X**: LoRA file name (`None` to skip)
- **lora_wt_X**: Overall strength (Simple Mode, -100.0 to 100.0)
- **model_str_X**: Model strength (Advanced Mode, -100.0 to 100.0)
- **clip_str_X**: CLIP strength (Advanced Mode, -100.0 to 100.0)

### UI Behavior

The node automatically updates the UI when:
- `lora_count` is changed → Number of visible LoRA slots changes
- `input_mode` is changed → Displayed strength parameters switch
- Node height automatically adjusts to accommodate both changes

## Requirements

- ComfyUI
- Nunchaku FLUX models (quantized)
- nunchaku >= 1.0.0
- Nunchaku FLUX compatible LoRA files

## Technical Details

### LoRA Composition
Multiple LoRAs are composed into a single state_dict before application, enabling efficient processing.

### PuLID Compatibility
PuLID weights are preserved during LoRA updates and restored afterwards, maintaining compatibility with PuLID.

### torch.compile Support
Properly handles models wrapped in `OptimizedModule`, accessing the actual model via `_orig_mod`.

### Automatic input_channels Adjustment
Automatically detects the required input_channels from `x_embedder.lora_A.weight` in the LoRA and updates the model configuration.

## License

Apache-2.0

## Credits

- Dynamic UI control implementation is inspired by [efficiency-nodes-comfyui](https://github.com/jags111/efficiency-nodes-comfyui)
- Developed for integration with the [Nunchaku](https://github.com/nunchaku-tech/ComfyUI-nunchaku) project

## References

- [Nunchaku Official Repository](https://github.com/nunchaku-tech/ComfyUI-nunchaku)
- [Nunchaku Official Documentation](https://nunchaku.tech/docs/ComfyUI-nunchaku/)
- [DeepCompressor (Quantization Library)](https://github.com/mit-han-lab/deepcompressor)

## Development Background

The standard LoRA Stacker in Nunchaku had poor usability, so it was reimplemented with an easy-to-use interface featuring height adjustment like efficiency-nodes-comfyui. By separating it as an independent Custom Node, it can be operated stably without being affected by updates to the main Nunchaku package.

This implementation uses both Python and JavaScript, making it a high-difficulty implementation that requires logic to load JavaScript implementing widget functionality from the Python side.


