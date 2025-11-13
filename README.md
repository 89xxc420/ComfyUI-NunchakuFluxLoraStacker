# ComfyUI-NunchakuFluxLoraStacker

A standalone ComfyUI custom node for stacking up to ten Nunchaku FLUX LoRAs with dynamic UI control.

## Features

- **Dynamic Slot Visibility**: LoRA widget count follows `lora_count`
- **Simple / Advanced Modes**: Toggle between single-strength and dual-strength inputs
- **Automatic Layout Sizing**: Node height expands or shrinks to match visible widgets
- **Nunchaku FLUX Ready**: Purpose-built for the Nunchaku FLUX checkpoint format

## Installation

1. Clone the repository inside your `ComfyUI/custom_nodes` directory:
   ```bash
   cd ComfyUI/custom_nodes
   git clone https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker.git
   ```
2. Restart ComfyUI to load the node.

## Usage

### Basic Flow

1. Add the **Nunchaku FLUX LoRA Stack** node to your workflow.
2. Connect the Nunchaku FLUX base model to the `model` input.
3. Set `lora_count` to the number of LoRA slots you want active.
4. Choose `input_mode`:
   - **simple**: Use `lora_wt_X` for all-in-one strength control.
   - **advanced**: Use `model_str_X` and `clip_str_X` for separate strength control.
5. Pick the LoRA file in each active slot and configure the strengths.
6. Connect the output to the next node in your graph.

### Parameters

- **model**: Nunchaku FLUX base model.
- **input_mode**
  - `simple`: Display LoRA name and a single strength slider.
  - `advanced`: Display separate model and CLIP strength sliders.
- **lora_count**: Number of LoRA slots to use (1-10).
- **lora_name_X**: LoRA file for slot X.
- **lora_wt_X**: Overall LoRA strength in simple mode.
- **model_str_X** / **clip_str_X**: Individual strengths in advanced mode.

## Dynamic UI Behavior

- Toggle LoRA slots based on `lora_count`.
- Switch between strength widgets depending on `input_mode`.
- Resize node height to match the visible widget stack.
- Refresh the layout immediately when parameters change.

## Requirements

- ComfyUI (2024 builds or newer recommended)
- Nunchaku core package (`nunchaku`) already installed in the environment
- LoRA files compatible with Nunchaku FLUX

## Release History

- v1.11 – Clarified installation instructions for environments where the `nunchaku` package is already provided. ([Issue #3](https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker/issues/3))
- [v1.10](https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker/releases/tag/v1.10) – LoRA Loader Fix - Complete Version

## License

Apache-2.0

## Credits

Based on the dynamic UI implementation from efficiency-nodes-comfyui.
