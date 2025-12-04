# v1.16: LoRA Stacker V2 - Standard SD Model Support

**Release Date:** December 5, 2025

---

## Overview: Universal LoRA Stacker for Standard Models

v1.16 introduces **LoRA Stacker V2**, a universal LoRA loading node for standard Stable Diffusion models (SDXL, SD1.5, SD2.x, etc.) with the same dynamic UI as FLUX LoRA Loader V2.

**Key Features:**
- 10 dynamic LoRA slots with real-time UI adjustment
- Supports standard SD models via ComfyUI's native `comfy.sd.load_lora_for_models`
- Compatible with SDXL, Flux (standard), WAN2.2, and other SD-based models
- Identical UI/UX to FLUX LoRA Loader V2

**Tested and Verified:**
- ✓ SDXL
- ✓ Flux (standard models)
- ✓ WAN2.2

---

## Part 1: Python Backend - `nodes/lora/standard.py`

### 1.1 Class Structure

**New File:** `nodes/lora/standard.py`

```python
class StandardLoraLoaderBase:
    """Base class for fixed-slot LoRA loaders for standard SD models."""
    
    _slot_count = 0

    def __init__(self):
        self.loaded_lora = None
```

**Key Design:**
- Inherits the same dynamic slot architecture as FLUX LoRA Loader V2
- Implements LoRA caching via `self.loaded_lora` to avoid redundant disk I/O
- Uses `_slot_count` class variable for dynamic node generation

### 1.2 INPUT_TYPES - Dual Input Design

```python
@classmethod
def INPUT_TYPES(cls):
    loras = ["None"] + folder_paths.get_filename_list("loras")
    
    inputs = {
        "required": {
            "model": ("MODEL", {"tooltip": "The diffusion model."}),
            "clip": ("CLIP", {"tooltip": "The CLIP model."}),
        },
        "optional": {},
    }

    for i in range(1, cls._slot_count + 1):
        inputs["optional"][f"lora_name_{i}"] = (loras, {"tooltip": f"LoRA {i} filename"})
        inputs["optional"][f"lora_wt_{i}"] = ("FLOAT", {"default": 1.0, "step": 0.001, "tooltip": f"LoRA {i} Strength"})

    return inputs
```

**Critical Difference from FLUX V2:**
- **FLUX V2:** `model` input only (Nunchaku FLUX uses custom wrapper)
- **Standard V2:** `model` AND `clip` inputs (standard SD requires both)

**Why Both Inputs Are Required:**

Standard SD LoRA application requires patching both:
1. **U-Net (model):** Controls denoising behavior and style
2. **CLIP (clip):** Controls text encoding and semantic understanding

ComfyUI's `comfy.sd.load_lora_for_models` function signature:
```python
def load_lora_for_models(model, clip, lora, strength_model, strength_clip):
```

This is fundamentally different from Nunchaku FLUX, which applies LoRAs directly to `model.model.diffusion_model` wrapper.

### 1.3 LoRA Application Logic - Standard SD Method

```python
def load_lora_stack(self, model, clip, **kwargs):
    loras_to_apply = []
    for i in range(1, self._slot_count + 1):
        lora_name = kwargs.get(f"lora_name_{i}")
        if not lora_name or lora_name == "None": continue
        
        lora_wt = kwargs.get(f"lora_wt_{i}", 1.0)
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

    # Use ComfyUI standard LoRA loading
    current_model = model
    current_clip = clip
    
    for name, strength in loras_formatted:
        if strength == 0:
            continue

        lora_path = folder_paths.get_full_path_or_raise("loras", name)
        lora = None
        if self.loaded_lora is not None:
            if self.loaded_lora[0] == lora_path:
                lora = self.loaded_lora[1]
            else:
                self.loaded_lora = None

        if lora is None:
            lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
            self.loaded_lora = (lora_path, lora)

        current_model, current_clip = comfy.sd.load_lora_for_models(
            current_model, current_clip, lora, strength, strength
        )
    
    return (current_model, current_clip)
```

**Implementation Details:**

1. **LoRA Collection & Deduplication:**
   - Iterates through all 10 slots
   - Skips "None" and empty slots
   - Deduplicates by name (first occurrence wins)
   - Filters out zero-strength LoRAs

2. **LoRA Caching:**
   ```python
   if self.loaded_lora is not None:
       if self.loaded_lora[0] == lora_path:
           lora = self.loaded_lora[1]
       else:
           self.loaded_lora = None
   ```
   - Checks if the same LoRA was loaded previously
   - Reuses cached LoRA data to avoid disk I/O
   - **Limitation:** Only caches the last loaded LoRA (not all 10)
   - This matches ComfyUI's native `LoraLoader` behavior

3. **Standard SD LoRA Application:**
   ```python
   current_model, current_clip = comfy.sd.load_lora_for_models(
       current_model, current_clip, lora, strength, strength
   )
   ```

   **What `comfy.sd.load_lora_for_models` does:**
   - Converts LoRA format via `comfy.lora_convert.convert_lora` (supports LoRA, LoCon, LoHa, LoKR)
   - Generates key maps for U-Net and CLIP
   - Clones model and clip patcher objects
   - Applies patches with specified strengths
   - Returns modified model and clip

4. **Strength Parameter:**
   - Uses single `lora_wt` value for both `strength_model` and `strength_clip`
   - This maintains UI parity with FLUX V2 (single strength slider per LoRA)
   - Standard ComfyUI `LoraLoader` allows separate `strength_model` and `strength_clip`, but V2 uses unified strength for simplicity

### 1.4 Comparison: FLUX V2 vs Standard V2

| Aspect | FLUX LoRA Loader V2 | LoRA Stacker V2 (Standard) |
|--------|---------------------|----------------------------|
| **Python File** | `flux_v2.py` | `standard.py` |
| **Target Models** | Nunchaku FLUX only | SDXL, SD1.5, SD2.x, WAN2.2 |
| **Inputs** | `model` only | `model` + `clip` |
| **Outputs** | `MODEL` only | `MODEL` + `CLIP` |
| **LoRA Application** | `model.model.diffusion_model` wrapper | `comfy.sd.load_lora_for_models` |
| **JavaScript** | `z_flux_lora_dynamic.js` | `lora_stacker_v2.js` |
| **UI** | Dynamic 10 slots | Dynamic 10 slots (identical) |

---

## Part 2: JavaScript Frontend - `js/lora_stacker_v2.js`

### 2.1 Extension Registration

```javascript
app.registerExtension({
    name: "nunchaku.lora_stacker_v2",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "LoraStackerV2_10") {
            nodeType["@visibleLoraCount"] = { 
                type: "number", default: 1, min: 1, max: 10, step: 1 
            };
        }
    },

    nodeCreated(node) {
        if (node.comfyClass !== "LoraStackerV2_10") return;
        // ...
    }
});
```

**Key Points:**
- Extension name: `"nunchaku.lora_stacker_v2"` (unique to avoid conflicts)
- Target node: `"LoraStackerV2_10"`
- Defines `@visibleLoraCount` property (1-10 slots)

### 2.2 Widget Caching System

```javascript
node.cachedWidgets = {};
let cacheReady = false;

const initCache = () => {
    if (cacheReady) return;
    const all = [...node.widgets];
    for (let i = 1; i <= 10; i++) {
        const wName = all.find(w => w.name === `lora_name_${i}`);
        const wWt = all.find(w => w.name === `lora_wt_${i}`);
        if (wName && wWt) {
            node.cachedWidgets[i] = [wName, wWt];
            wName.type = "combo";
            wWt.type = "number";
            if (wName.computeSize) delete wName.computeSize;
            if (wWt.computeSize) delete wWt.computeSize;
        }
    }
    cacheReady = true;
};
```

**Widget Caching Strategy:**
- Stores references to all 20 widgets (10 × lora_name + 10 × lora_wt)
- Preserves widget values when toggling visibility
- Prevents widget recreation overhead
- Ensures consistent widget behavior

**Identical to FLUX V2 implementation**

### 2.3 Dynamic Slot Control

```javascript
const ensureControlWidget = () => {
    const name = "🔢 LoRA Count";
    
    // Remove old button widgets
    for (let i = node.widgets.length - 1; i >= 0; i--) {
        const w = node.widgets[i];
        if (w.name === "🔢 Set LoRA Count" || w.type === "button") {
            node.widgets.splice(i, 1);
        }
    }

    let w = node.widgets.find(x => x.name === name);
    if (!w) {
        const values = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
        w = node.addWidget("combo", name, "1", (v) => {
            const num = parseInt(v);
            if (!isNaN(num)) {
                node.properties["visibleLoraCount"] = num;
                node.updateLoraSlots();
            }
        }, { values });
    }
    w.value = node.properties["visibleLoraCount"].toString();
    return w;
};
```

**Control Widget Management:**
- Creates dropdown selector ("🔢 LoRA Count")
- Removes legacy button-based controls
- Syncs with `node.properties["visibleLoraCount"]`
- Triggers `updateLoraSlots()` on change

### 2.4 Physical Widget Reconstruction

```javascript
node.updateLoraSlots = function() {
    if (!cacheReady) initCache();

    const count = parseInt(this.properties["visibleLoraCount"] || 1);
    const controlWidget = ensureControlWidget();

    // Physical widget reconstruction for clean layout
    this.widgets = [controlWidget];

    for (let i = 1; i <= count; i++) {
        const pair = this.cachedWidgets[i];
        if (pair) {
            this.widgets.push(pair[0]); // lora_name
            this.widgets.push(pair[1]); // lora_wt
        }
    }

    // Height calculation
    const HEADER_H = 60;
    const SLOT_H = 54;
    const PADDING = 20;
    const targetH = HEADER_H + (count * SLOT_H) + PADDING;
    
    this.setSize([this.size[0], targetH]);
    
    if (app.canvas) app.canvas.setDirty(true, true);
};
```

**Physical Reconstruction Pattern:**
- Clears `this.widgets` array completely
- Rebuilds from scratch using cached widget references
- Ensures clean layout without ghost widgets
- Recalculates height based on visible slot count

**Height Formula:**
```
Total Height = HEADER_H + (visible_count × SLOT_H) + PADDING
             = 60 + (N × 54) + 20
```

### 2.5 Workflow Persistence

```javascript
const origOnConfigure = node.onConfigure;
node.onConfigure = function() {
     if (origOnConfigure) origOnConfigure.apply(this, arguments);
     setTimeout(() => node.updateLoraSlots(), 100);
};

setTimeout(() => {
    initCache();
    node.updateLoraSlots();
}, 100);
```

**Persistence Mechanism:**
- Hooks into `onConfigure` (fired when workflow loads)
- Uses `setTimeout(100ms)` to ensure graph is fully initialized
- Restores UI state based on saved `visibleLoraCount` property
- Ensures consistent UI across workflow save/load cycles

---

## Part 3: Registration - `__init__.py`

### 3.1 Import and Integration

```python
from .nodes.lora.standard import (
    GENERATED_NODES as STANDARD_LORA_NODES, 
    GENERATED_DISPLAY_NAMES as STANDARD_LORA_NAMES
)

NODE_CLASS_MAPPINGS = {
    "FluxLoraMultiLoader": NunchakuFluxLoraStack,
    **FLUX_NODES,
    **STANDARD_LORA_NODES,
    **MISC_NODES
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FluxLoraMultiLoader": "FLUX LoRA Multi Loader (Legacy - Do Not Use in V2)",
    **FLUX_NAMES,
    **STANDARD_LORA_NAMES,
    **MISC_NAMES
}
```

**Integration Points:**
1. `standard.py` generates `LoraStackerV2_10` node class
2. Merged into `NODE_CLASS_MAPPINGS` alongside FLUX nodes
3. Display name: "LoRA Stacker V2"
4. Category: `loaders`

---

## Part 4: Technical Deep Dive

### 4.1 Why Standard SD Requires Different Implementation

**FLUX LoRA Loader V2 (Nunchaku FLUX):**
```python
model_wrapper = model.model.diffusion_model
actual_wrapper = model_wrapper._orig_mod if hasattr(model_wrapper, "_orig_mod") else model_wrapper

if wrapper_class == "ComfyFluxWrapper":
    actual_wrapper.loras = []
    actual_wrapper.loras.append((path, strength))
elif wrapper_class == "NunchakuFluxTransformer2dModel":
    actual_wrapper.update_lora_params(...)
```

**Nunchaku FLUX Approach:**
- Directly accesses `model.model.diffusion_model` wrapper
- Sets LoRA via wrapper's `loras` attribute or `update_lora_params()`
- No CLIP involvement (Nunchaku FLUX handles text encoding differently)
- Highly optimized for Nunchaku FLUX architecture

**LoRA Stacker V2 (Standard SD):**
```python
current_model, current_clip = comfy.sd.load_lora_for_models(
    current_model, current_clip, lora, strength, strength
)
```

**Standard SD Approach:**
- Uses ComfyUI's native `comfy.sd.load_lora_for_models`
- Applies LoRA to both model and CLIP via patch system
- Clones model/clip patcher objects to prevent mutation
- Supports all SD architectures (SDXL, SD1.5, SD2.x, etc.)

### 4.2 Inside `comfy.sd.load_lora_for_models`

**Full Internal Process (from `comfy/sd.py`):**

```python
def load_lora_for_models(model, clip, lora, strength_model, strength_clip):
    # Step 1: Generate key maps
    key_map = {}
    if model is not None:
        key_map = comfy.lora.model_lora_keys_unet(model.model, key_map)
    if clip is not None:
        key_map = comfy.lora.model_lora_keys_clip(clip.cond_stage_model, key_map)

    # Step 2: Convert LoRA format (supports LoRA, LoCon, LoHa, LoKR)
    lora = comfy.lora_convert.convert_lora(lora)
    
    # Step 3: Load LoRA with key mapping
    loaded = comfy.lora.load_lora(lora, key_map)
    
    # Step 4: Apply to model
    if model is not None:
        new_modelpatcher = model.clone()
        k = new_modelpatcher.add_patches(loaded, strength_model)
    else:
        k = ()
        new_modelpatcher = None

    # Step 5: Apply to CLIP
    if clip is not None:
        new_clip = clip.clone()
        k1 = new_clip.add_patches(loaded, strength_clip)
    else:
        k1 = ()
        new_clip = None
    
    # Step 6: Warn about unloaded keys
    k = set(k)
    k1 = set(k1)
    for x in loaded:
        if (x not in k) and (x not in k1):
            logging.warning("NOT LOADED {}".format(x))

    return (new_modelpatcher, new_clip)
```

**Key Features:**
1. **Format Support:** Automatically handles LoRA, LoCon, LoHa, LoKR via `comfy.lora_convert.convert_lora`
2. **Key Mapping:** Generates architecture-specific key maps for U-Net and CLIP
3. **Patch System:** Uses ModelPatcher.add_patches() for non-destructive application
4. **Cloning:** Creates new patcher instances to prevent original model/clip mutation
5. **Validation:** Warns about LoRA keys that couldn't be applied

### 4.3 Strength Application Strategy

**User Expectation (from UI):**
- Single `lora_wt` slider per LoRA

**Internal Application:**
```python
current_model, current_clip = comfy.sd.load_lora_for_models(
    current_model, current_clip, lora, strength, strength
)
```

**Why Same Strength for Both:**
- Maintains UI simplicity (single slider)
- Matches FLUX V2 UI pattern
- Most users want uniform strength across model and CLIP
- Advanced users can chain multiple `LoRA Stacker V2` nodes for fine control

**Alternative (not implemented):**
ComfyUI's native `LoraLoader` provides separate `strength_model` and `strength_clip` sliders, but this would break UI parity with FLUX V2.

---

## Part 5: Usage Example

### 5.1 Basic Workflow

```
[Checkpoint Loader]
    ↓ MODEL
    ↓ CLIP
[LoRA Stacker V2]
    - LoRA Count: 3
    - lora_name_1: "style_enhance.safetensors"
    - lora_wt_1: 0.8
    - lora_name_2: "detail_boost.safetensors"
    - lora_wt_2: 1.2
    - lora_name_3: "color_pop.safetensors"
    - lora_wt_3: 0.6
    ↓ MODEL
    ↓ CLIP
[KSampler]
```

### 5.2 Tested Model Compatibility

**SDXL:**
- ✓ Base models (sd_xl_base_1.0.safetensors)
- ✓ SDXL LoRAs
- ✓ Full workflow execution

**Flux (Standard Models):**
- ✓ Flux Dev/Schnell
- ✓ Standard Flux LoRAs
- ✓ Full workflow execution

**WAN2.2:**
- ✓ WAN2.2 base models
- ✓ WAN-specific LoRAs
- ✓ Full workflow execution

---

## Summary

**What's New in v1.16:**
- Added `LoRA Stacker V2` node for standard SD models
- Python backend: `nodes/lora/standard.py` using `comfy.sd.load_lora_for_models`
- JavaScript frontend: `js/lora_stacker_v2.js` (identical UI to FLUX V2)
- Supports SDXL, Flux (standard), WAN2.2, and other SD-based architectures
- 10 dynamic slots with real-time UI adjustment
- Tested and verified across multiple model types

**Files Added:**
- `nodes/lora/standard.py` (113 lines)
- `js/lora_stacker_v2.js` (115 lines)

**Files Modified:**
- `__init__.py` (added STANDARD_LORA_NODES registration)

---

**Repository:** https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker  
**Release:** v1.16  
**Date:** December 5, 2025

