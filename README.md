# ComfyUI-NunchakuFluxLoraStacker

A standalone ComfyUI custom node for Nunchaku FLUX LoRA Stacking with dynamic UI control.

## Features

- **Dynamic UI Control**: Automatically adjusts the number of visible LoRA slots based on `lora_count` parameter
- **Input Mode Support**: 
  - **Simple Mode**: Shows only LoRA name and weight
  - **Advanced Mode**: Shows separate model and clip strengths
- **Up to 10 LoRAs**: Support for applying multiple LoRAs simultaneously
- **Automatic Height Adjustment**: Node height adjusts dynamically based on visible widgets
- **Nunchaku FLUX Compatible**: Designed specifically for Nunchaku FLUX models

## Installation

1. Clone this repository to your ComfyUI custom_nodes directory:
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/your-username/ComfyUI-NunchakuFluxLoraStacker.git
```

2. Restart ComfyUI

## Usage

### Basic Usage

1. Add a **Nunchaku FLUX LoRA Stack** node to your workflow
2. Connect your Nunchaku FLUX model to the `model` input
3. Set the `lora_count` to control how many LoRA slots are visible
4. Choose your `input_mode`:
   - **Simple**: Use `lora_wt_X` for overall strength
   - **Advanced**: Use `model_str_X` and `clip_str_X` for separate strengths
5. Select LoRA files and set their strengths
6. Connect the output to your next node

### Parameters

- **model**: The Nunchaku FLUX model to apply LoRAs to
- **input_mode**: 
  - `simple`: Shows only LoRA name and weight
  - `advanced`: Shows separate model and clip strengths
- **lora_count**: Number of LoRA slots to process (1-10)
- **lora_name_X**: LoRA file name for slot X
- **lora_wt_X**: Overall strength for LoRA X (simple mode)
- **model_str_X**: Model strength for LoRA X (advanced mode)
- **clip_str_X**: CLIP strength for LoRA X (advanced mode)

## Dynamic UI Behavior

The node automatically:
- Shows/hides LoRA slots based on `lora_count`
- Shows/hides strength widgets based on `input_mode`
- Adjusts node height to fit visible widgets
- Updates in real-time when parameters change

## Requirements

- ComfyUI
- Nunchaku FLUX models
- LoRA files compatible with Nunchaku FLUX

## Release History

- [v1.10](https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker/releases/tag/v1.10) – LoRA Loader Fix - Complete Version

## License

Apache-2.0

## Credits

Based on efficiency-nodes-comfyui implementation with dynamic UI control.
