# v1.14: Node Simplification - V2 Only

**Release Date:** December 4, 2025

---

## Overview: From 10 Nodes to 1

This release removes test nodes (x1-x9) and keeps only the production-ready **FLUX LoRA Loader V2** (x10).

**Major Changes:**
• Removed 9 test node variants (FluxLoraMultiLoader_1 through FluxLoraMultiLoader_9)
• Keep only FluxLoraMultiLoader_10 (FLUX LoRA Loader V2)
• Cleaner node selection menu in ComfyUI
• Updated version to 1.14

---

## Part 1: Why Remove x1-x9?

### 1.1 The Original Purpose of Multiple Node Variants

**Development History:**

**Phase 1: Testing Fixed-Slot Architecture (Early Development)**

When developing the FLUX LoRA Loader system, 10 separate node variants were created:

```python
FluxLoraMultiLoader_1  → "FLUX LoRA Loader (x1)"  # 1 fixed slot
FluxLoraMultiLoader_2  → "FLUX LoRA Loader (x2)"  # 2 fixed slots
FluxLoraMultiLoader_3  → "FLUX LoRA Loader (x3)"  # 3 fixed slots
...
FluxLoraMultiLoader_9  → "FLUX LoRA Loader (x9)"  # 9 fixed slots
FluxLoraMultiLoader_10 → "FLUX LoRA Loader V2"    # 10 dynamic slots
```

**Why This Was Done:**
1. **Backend Testing**: Verify Python logic worked correctly with different slot counts
2. **UI Prototyping**: Test different fixed configurations before implementing dynamic UI
3. **Incremental Development**: Build complexity gradually from 1 slot to 10 slots
4. **Validation Testing**: Ensure each slot count worked independently

**Phase 2: V2 Development (v1.12)**

`FluxLoraMultiLoader_10` was enhanced with **dynamic slot control**:
• Combo box dropdown (1-10 selection)
• Physical widget reconstruction
• Manual height calculation
• Python `optional` inputs

**Result:** x10 (V2) could do the job of all 10 nodes combined.

**Phase 3: Legacy Maintenance (v1.12 - v1.13)**

x1-x9 were kept for:
• Backward compatibility testing
• User migration buffer
• Code structure validation

**Phase 4: Cleanup (v1.14)**

Testing complete. x1-x9 confirmed redundant and removed.

---

### 1.2 Problems with Multiple Node Variants

#### Problem 1: Node Menu Clutter

**Before v1.14:**
```
Add Node > FLUX > MultiLoader
├─ FLUX LoRA Loader (x1)
├─ FLUX LoRA Loader (x2)
├─ FLUX LoRA Loader (x3)
├─ FLUX LoRA Loader (x4)
├─ FLUX LoRA Loader (x5)
├─ FLUX LoRA Loader (x6)
├─ FLUX LoRA Loader (x7)
├─ FLUX LoRA Loader (x8)
├─ FLUX LoRA Loader (x9)
└─ FLUX LoRA Loader V2
```

**After v1.14:**
```
Add Node > FLUX > MultiLoader
└─ FLUX LoRA Loader V2
```

**Impact:**
• Users confused: "Which one should I use?"
• Search results cluttered with similar nodes
• Professional users annoyed by test nodes in production environment

#### Problem 2: Maintenance Burden

**Code Duplication:**
• 10 identical `FluxLoraMultiLoaderBase` instances
• Same logic, different `_slot_count` value
• Any bug fix requires testing all 10 variants
• Documentation effort multiplied by 10

**Backend Overhead:**
• ComfyUI loads all 10 node definitions on startup
• Memory usage for redundant node classes
• Node validation logic runs for all 10 types

#### Problem 3: User Confusion

**Common Questions:**
• "What's the difference between x5 and V2 set to 5 slots?"
• "Should I use x3 or V2?"
• "Why are there 10 similar nodes?"

**Answer (Now Clear):**
• Use V2. Period.
• x1-x9 were test nodes never intended for production

---

## Part 2: Technical Implementation

### 2.1 Code Changes in `flux_v2.py`

#### Before (v1.13): Loop Generating 10 Nodes

```python
GENERATED_NODES = {}
GENERATED_DISPLAY_NAMES = {}

# Generate nodes for 1 to 10 slots
for i in range(1, 11):
    class_name = f"FluxLoraMultiLoader_{i}"
    
    # FluxLoraMultiLoader_10 gets special V2 name
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
```

**Problems:**
• Generates 10 node classes on every ComfyUI startup
• x1-x9 are dead code (never used in production)
• Clutters `NODE_CLASS_MAPPINGS` with 9 redundant entries

#### After (v1.14): Direct V2 Generation Only

```python
GENERATED_NODES = {}
GENERATED_DISPLAY_NAMES = {}

# Generate only FluxLoraMultiLoader_10 (V2)
class_name = "FluxLoraMultiLoader_10"
title = "FLUX LoRA Loader V2"
display_name = "FLUX LoRA Loader V2"

node_class = type(class_name, (FluxLoraMultiLoaderBase,), {
    "_slot_count": 10,
    "TITLE": title,
    "DESCRIPTION": "Load up to 10 LoRAs."
})

GENERATED_NODES[class_name] = node_class
GENERATED_DISPLAY_NAMES[class_name] = display_name
```

**Benefits:**
• Only 1 node class generated
• Cleaner `NODE_CLASS_MAPPINGS`
• Faster startup (marginal, but cleaner code)
• Obvious choice for users: "Use V2"

---

### 2.2 Why `FluxLoraMultiLoaderBase` is Unchanged

**The Base Class is Perfect:**

```python
class FluxLoraMultiLoaderBase:
    """Base class for fixed-slot LoRA loaders."""
    
    _slot_count = 0  # Overridden by subclass

    @classmethod
    def INPUT_TYPES(cls):
        loras = ["None"] + folder_paths.get_filename_list("loras")
        
        inputs = {
            "required": {
                "model": ("MODEL", {"tooltip": "..."}),
            },
            "optional": {},  # Critical: All lora_X inputs are optional
        }

        for i in range(1, cls._slot_count + 1):
            inputs["optional"][f"lora_name_{i}"] = (loras, ...)
            inputs["optional"][f"lora_wt_{i}"] = ("FLOAT", {"default": 1.0, ...})

        return inputs
```

**Why No Changes Needed:**
• `_slot_count` is set by subclass (now only x10 sets it to 10)
• `optional` inputs system works perfectly
• Logic is slot-count agnostic (works for any count 1-10)

**Key Insight:**
• Removing x1-x9 doesn't require base class changes
• Only the **instantiation loop** needed modification
• Backend logic is completely reusable

---

## Part 3: FLUX LoRA Loader V2 Architecture (Unchanged, Still Excellent)

### 3.1 JavaScript UI Controller: `z_flux_lora_dynamic.js`

**File Status in v1.14:** **No changes** (already perfect in v1.12/v1.13)

#### Core Innovation: Physical Widget Reconstruction

```javascript
node.updateLoraSlots = function() {
    if (!cacheReady) initCache();

    const count = parseInt(this.properties["visibleLoraCount"] || 1);
    const controlWidget = ensureControlWidget();

    // PHYSICAL RECONSTRUCTION: Clear and rebuild
    this.widgets = [controlWidget];

    for (let i = 1; i <= count; i++) {
        const pair = this.cachedWidgets[i];
        if (pair) {
            this.widgets.push(pair[0]);  // lora_name_X
            this.widgets.push(pair[1]);  // lora_wt_X
        }
    }

    // Manual height calculation (pixel-perfect)
    const HEADER_H = 60;
    const SLOT_H = 54;
    const PADDING = 20;
    const targetH = HEADER_H + (count * SLOT_H) + PADDING;
    
    this.setSize([this.size[0], targetH]);
    
    if (app.canvas) app.canvas.setDirty(true, true);
};
```

**Why This Works:**

| Approach | Method | Layout Quality | Performance |
|----------|--------|----------------|-------------|
| **V1 (widgethider.js)** | Type manipulation (`HIDDEN_TAG`) | Unstable padding | Fast |
| **V2 (z_flux_lora_dynamic.js)** | Physical removal from array | Pixel-perfect | Fast |

**V2 Advantages:**
1. **Guaranteed Layout**: Only visible widgets exist in `node.widgets` array
2. **No Ghost Widgets**: Hidden widgets don't occupy memory or cause layout issues
3. **Precise Height**: Manual calculation eliminates padding inconsistencies
4. **Robust State**: Widget values preserved in `cachedWidgets` during reconstruction

#### Widget Caching System

```javascript
node.cachedWidgets = {};

const initCache = () => {
    if (cacheReady) return;
    const all = [...node.widgets];
    
    for (let i = 1; i <= 10; i++) {
        const wName = all.find(w => w.name === `lora_name_${i}`);
        const wWt = all.find(w => w.name === `lora_wt_${i}`);
        
        if (wName && wWt) {
            node.cachedWidgets[i] = [wName, wWt];
            
            // Force correct types
            wName.type = "combo";
            wWt.type = "number";
            
            // Remove custom computeSize
            if (wName.computeSize) delete wName.computeSize;
            if (wWt.computeSize) delete wWt.computeSize;
        }
    }
    cacheReady = true;
};
```

**Why Caching is Critical:**
• Widgets are **removed** from `node.widgets` array when hidden
• Without cache, their **values would be lost**
• Cache preserves original widget objects (including user-selected LoRA names and strengths)
• When slot count increases, cached widgets are re-added with values intact

**Example Flow:**
1. User sets 5 slots, selects 5 LoRAs → All values stored in cached widgets
2. User reduces to 3 slots → Widgets 4-5 removed from `node.widgets` but **still in cache**
3. User increases to 7 slots → Widgets 4-5 restored from cache **with original values**, new widgets 6-7 added
4. Values never lost, seamless user experience

#### Combo Box Control

```javascript
const ensureControlWidget = () => {
    const name = "🔢 LoRA Count";
    
    // Remove old button widgets (migration from v1.12 beta)
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

**Design Decisions:**
• **Combo box** instead of button + prompt: Better UX, no invalid input
• **Always at top**: Control widget is always `this.widgets[0]`
• **Value sync**: Combo box value always matches `node.properties["visibleLoraCount"]`

#### State Persistence

```javascript
// Restore UI on workflow load
const origOnConfigure = node.onConfigure;
node.onConfigure = function() {
     if (origOnConfigure) origOnConfigure.apply(this, arguments);
     setTimeout(() => node.updateLoraSlots(), 100);
};
```

**Why This is Critical:**

Without `onConfigure`:
1. User saves workflow with 7 slots selected
2. User reloads workflow
3. Node shows 10 slots (default) even though property says 7
4. UI doesn't match saved state

With `onConfigure`:
1. Workflow loads
2. Properties are restored (including `visibleLoraCount = 7`)
3. `onConfigure` triggers `updateLoraSlots()`
4. UI rebuilds to show exactly 7 slots
5. Perfect state restoration

---

## Part 2: What Changed in v1.14

### 2.1 File-by-File Breakdown

#### Modified: `nodes/lora/flux_v2.py`

**Before v1.14:**
```python
# Loop generates 10 node classes
for i in range(1, 11):
    class_name = f"FluxLoraMultiLoader_{i}"
    if i == 10:
        title = "FLUX LoRA Loader V2"
    else:
        title = f"FLUX LoRA Loader (x{i})"  # x1-x9
    # ... create node class
```

**After v1.14:**
```python
# Direct generation of V2 only
class_name = "FluxLoraMultiLoader_10"
title = "FLUX LoRA Loader V2"
display_name = "FLUX LoRA Loader V2"

node_class = type(class_name, (FluxLoraMultiLoaderBase,), {
    "_slot_count": 10,
    "TITLE": title,
    "DESCRIPTION": "Load up to 10 LoRAs."
})

GENERATED_NODES[class_name] = node_class
GENERATED_DISPLAY_NAMES[class_name] = display_name
```

**Impact:**
• 9 node classes eliminated
• `NODE_CLASS_MAPPINGS` now has 1 entry instead of 10
• ComfyUI node menu shows 1 node instead of 10

#### Modified: `pyproject.toml`

```toml
version = "1.13"  →  version = "1.14"
```

#### Unchanged Files

**No changes to:**
• `js/z_flux_lora_dynamic.js` - V2 UI controller (already perfect)
• `js/fast_bypass_v2.js` - Fast Groups Bypasser V2 (unrelated feature)
• `js/widgethider.js` - V1 widget hider (backward compatibility)
• `README.md` - Documentation (already describes V2)
• `__init__.py` - Node registration (works with any number of nodes)

**Total Changes:**
• 2 files modified
• 14 lines added, 20 lines removed
• Zero functional changes for V2 users

---

### 2.2 Migration Impact Analysis

#### Scenario 1: V2 Users (Majority)

**Workflow Contains:** `FluxLoraMultiLoader_10` (FLUX LoRA Loader V2)

**Impact:** **ZERO**

V2 node is unchanged. All workflows work identically.

#### Scenario 2: x1-x9 Users (Edge Case)

**Workflow Contains:** `FluxLoraMultiLoader_3` (FLUX LoRA Loader (x3))

**Impact:** Node shows as **red/missing** in ComfyUI

**Migration Steps:**

**Option A: Manual Replacement (Recommended)**
1. Open workflow in ComfyUI
2. Node appears red with "Missing Node: FluxLoraMultiLoader_3"
3. Delete the red node
4. Add `FLUX LoRA Loader V2` from node menu
5. Set combo box to "3" (matching original slot count)
6. Reconnect input/output wires
7. Re-select LoRA files (values not auto-migrated)
8. Save workflow

**Option B: JSON Editing (Advanced)**
```json
// Find in workflow JSON:
{
  "class_type": "FluxLoraMultiLoader_3",
  "inputs": {
    "model": [...],
    "lora_name_1": "my_lora.safetensors",
    "lora_wt_1": 1.0,
    // ...
  }
}

// Change to:
{
  "class_type": "FluxLoraMultiLoader_10",
  "inputs": {
    "model": [...],
    "lora_name_1": "my_lora.safetensors",
    "lora_wt_1": 1.0,
    // ...
  },
  "properties": {
    "visibleLoraCount": 3  // Set to original count
  }
}
```

**Option C: Keep v1.13**

If migration is too complex, stay on v1.13. x1-x9 nodes still work there.

---

## Part 3: FLUX LoRA Loader V2 - Complete Architecture Reference

### 3.1 Why V2 is Superior

#### Comparison: V1 vs V2

| Feature | V1 (widgethider.js) | V2 (z_flux_lora_dynamic.js) |
|---------|---------------------|------------------------------|
| **Widget Hiding** | Type manipulation (`HIDDEN_TAG`) | Physical removal from array |
| **Height Adjustment** | `computeSize()` override | Manual calculation |
| **Control UI** | Button + manual input | Combo box dropdown |
| **Python Inputs** | All `required` | All `optional` |
| **State Persistence** | `serialize_widgets = false` (broken) | Default `true` + `onConfigure` |
| **Validation Errors** | Frequent ("Required input is missing") | None |
| **Layout Consistency** | Unstable padding (10-slot space for 3 slots) | Pixel-perfect (exact space for N slots) |
| **ComfyUI 2.0 Compatibility** | Poor (rendering glitches) | Excellent |

**V1 Problem Example:**

User selects 3 slots:
• Widget 4-10 are hidden via `type = "HIDDEN_TAG"`
• But widgets still exist in `node.widgets` array
• `computeSize()` tries to calculate height, but hidden widgets confuse it
• Result: Node has padding for 10 slots even though only 3 are visible
• User sees excessive white space at bottom

**V2 Solution:**

User selects 3 slots:
• `node.widgets = [controlWidget]` (clear array)
• Only widgets 1-3 added back to array
• `targetH = 60 + (3 × 54) + 20 = 242px` (precise)
• Result: Node is exactly 242px tall, no wasted space

---

### 3.2 Height Calculation Deep Dive

```javascript
const HEADER_H = 60;    // Title bar (30px) + model input widget (30px)
const SLOT_H = 54;      // lora_name combo (27px) + lora_wt number (27px)
const PADDING = 20;     // Bottom margin for visual comfort
const targetH = HEADER_H + (count * SLOT_H) + PADDING;
```

**Why These Values?**

| Component | Height | Explanation |
|-----------|--------|-------------|
| **HEADER_H = 60** | 60px | Title bar (30px) + model input (30px) |
| **SLOT_H = 54** | 54px | lora_name (27px) + lora_wt (27px) |
| **PADDING = 20** | 20px | Visual breathing room at bottom |

**Example Calculations:**

```javascript
count = 1:  targetH = 60 + (1 × 54) + 20 = 134px
count = 3:  targetH = 60 + (3 × 54) + 20 = 242px
count = 5:  targetH = 60 + (5 × 54) + 20 = 350px
count = 10: targetH = 60 + (10 × 54) + 20 = 620px
```

**Why Manual Calculation Instead of `computeSize()`?**

LiteGraph's `computeSize()` has issues:
1. Includes hidden widgets in calculation (if using `HIDDEN_TAG`)
2. Adds inconsistent padding based on widget type
3. Doesn't account for custom widget states
4. Can't be reliably overridden without side effects

Manual calculation gives:
• Absolute control over node height
• Predictable, testable results
• No mysterious padding issues

---

### 3.3 Widget Type Management

#### The Type Corruption Problem

**Background:**

When using `HIDDEN_TAG` approach, widgets can get corrupted:

```javascript
// Widget starts as:
widget.type = "combo"

// Hidden via:
widget.type = "tschide"

// Workflow saved with widget.type = "tschide"

// Workflow reloaded:
widget.type = "tschide"  // WRONG! Should be "combo"
```

**V2 Solution:**

```javascript
const initCache = () => {
    // ...
    for (let i = 1; i <= 10; i++) {
        const wName = all.find(w => w.name === `lora_name_${i}`);
        const wWt = all.find(w => w.name === `lora_wt_${i}`);
        
        if (wName && wWt) {
            node.cachedWidgets[i] = [wName, wWt];
            
            // FORCE correct types (even if corrupted)
            wName.type = "combo";
            wWt.type = "number";
            
            // Remove custom computeSize (can cause issues)
            if (wName.computeSize) delete wName.computeSize;
            if (wWt.computeSize) delete wWt.computeSize;
        }
    }
};
```

**Why Force Types?**
• Workflows saved in v1.12 beta might have `type = "tschide"` in JSON
• Loading such workflow would cause widgets to be invisible forever
• Forcing `combo`/`number` guarantees correct type regardless of save state
• `cachedWidgets` stores corrected widget references

---

## Part 4: Fast Groups Bypasser V2 (Unchanged)

**File:** `js/fast_bypass_v2.js`

**Status in v1.14:** **No changes** (ported feature, stable)

**Brief Summary:**
• Ported from rgthree-comfy
• Provides checkbox toggles for workflow groups
• Filters groups by color or title regex
• Auto-refreshes when groups change
• Completely independent from LoRA Loader

**Not Documented in Detail Here Because:**
• It's a ported feature (credit to rgthree)
• Unrelated to FLUX LoRA loading
• Functionality is self-explanatory in UI
• Original documentation available at rgthree-comfy repo

---

## Part 5: Benefits of v1.14

### 5.1 For New Users

**Simpler Onboarding:**
• Search for "FLUX LoRA" → See 1 clear choice: "V2"
• No confusion about which node to use
• Documentation focuses on 1 node, not 10 variants

**Before v1.14 (New User Experience):**
```
User: "I need to load LoRAs for FLUX"
Menu: Shows 10 nodes (x1, x2, ..., x9, V2)
User: "Which one do I use???"
User: Picks x5, doesn't know V2 exists with dropdown
User: Later finds out x5 is a test node, frustrated
```

**After v1.14 (New User Experience):**
```
User: "I need to load LoRAs for FLUX"
Menu: Shows 1 node (V2)
User: "Ah, this is the one."
User: Uses dropdown to set slot count, perfect experience
```

### 5.2 For Existing V2 Users

**No Changes Required:**
• All workflows using V2 work identically
• Zero migration effort
• Same features, same behavior
• Just cleaner environment

### 5.3 For Repository Maintainers

**Cleaner Codebase:**
• Less code to maintain (removed 9 node variants)
• Clearer intent (V2 is THE node, not just one of 10)
• Easier to add features (only 1 node to modify)
• Professional appearance (no test artifacts in releases)

---

## Part 6: Technical Specifications

### 6.1 Node Capabilities

**FLUX LoRA Loader V2:**
• **Slots:** 1-10 (user-selectable via dropdown)
• **Input:** MODEL (from Nunchaku FLUX DiT Loader)
• **Output:** MODEL (with LoRAs applied)
• **LoRA Strength:** 0.001 precision, default 1.0
• **Python Backend:** `optional` inputs, robust validation
• **JavaScript UI:** Physical widget reconstruction, pixel-perfect layout
• **State Persistence:** Full support for save/load workflows

### 6.2 Supported Workflows

**Compatible Model Loaders:**
1. **Nunchaku FLUX DiT Loader** (primary target)
2. **ComfyFluxWrapper** (standard ComfyUI FLUX)
3. Any model wrapper exposing `diffusion_model` attribute

**LoRA Application:**
• Sequential application (order matters)
• Deduplication (same LoRA multiple times → applied once)
• Strength composition (supports negative values for testing)

---

## Part 7: Installation and Upgrade

### 7.1 Fresh Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker.git
cd ComfyUI-NunchakuFluxLoraStacker
git checkout v1.14
```

**Result:**
• Only V2 node appears in menu
• Clean installation with no test nodes

### 7.2 Upgrade from v1.13

**For V2 Users (Most Common):**
```bash
cd ComfyUI/custom_nodes/ComfyUI-NunchakuFluxLoraStacker
git pull origin main
git checkout v1.14
```

**Result:**
• x1-x9 nodes disappear from menu
• V2 continues working identically
• Existing workflows unaffected

**For x1-x9 Users (Rare):**

See "Part 2, Section 2.2: Migration Impact Analysis" above.

### 7.3 Verification

**After installation/upgrade:**

1. **Restart ComfyUI**
2. **Check node menu:**
   • Search "FLUX LoRA"
   • Should see **only** "FLUX LoRA Loader V2"
   • x1-x9 should **not** appear
3. **Test V2 node:**
   • Add to canvas
   • Verify combo box shows 1-10
   • Change slot count, verify height adjusts
4. **Console check:**
   ```
   ★★★ z_flux_lora_dynamic.js: RESTORE COMBO BOX + PHYSICAL DELETE (FINAL) ★★★
   ```

---

## Part 8: Backward Compatibility

### 8.1 V1 Nodes (Non-V2)

**Node:** `FluxLoraMultiLoader` (not `_10`)
**Status:** Unchanged, still available
**Controller:** `js/widgethider.js`

**If you use the original V1 node**, it continues to work in v1.14.

### 8.2 Workflows Using x1-x9

**Status:** Breaking change (migration required)

**Why Not Keep for Compatibility?**

Considered, but rejected because:
1. x1-x9 were **never intended for production** (test nodes only)
2. V2 provides superior experience in every way
3. Keeping dead code harms repository quality
4. Very few users (if any) use x1-x9 in production

**Migration Support:**

If you have x1-x9 workflows and need help:
• Open GitHub issue with workflow details
• Community support available
• Migration is straightforward (replace node + set dropdown)

---

## Summary

### What v1.14 Does

**Removes:**
• 9 test node variants (x1-x9)
• Node menu clutter
• Maintenance burden

**Keeps:**
• FLUX LoRA Loader V2 (x10) - production-ready, fully featured
• Fast Groups Bypasser V2 - workflow utility
• FLUX LoRA Loader V1 - backward compatibility

**Adds:**
• Cleaner user experience
• Professional repository appearance
• Clear guidance: "Use V2"

### Who Should Upgrade

**Recommended for:**
• All new users (simpler onboarding)
• Existing V2 users (cleaner environment, no functional change)
• Repository maintainers (cleaner codebase)

**Not Urgent for:**
• Users on v1.13 with no issues (v1.14 is cleanup, not features)

**Required Migration for:**
• Users with workflows containing x1-x9 nodes (rare)

---

## Technical Deep Dive: Why Physical Reconstruction Works

### The Core Problem

**LiteGraph Widget System:**
• Widgets in `node.widgets[]` array are **always rendered**
• Even if `widget.type = "HIDDEN_TAG"`, widget still occupies array slot
• `computeSize()` iterates through entire array (including hidden widgets)

**V1 Workaround (Fragile):**
```javascript
widget.type = "HIDDEN_TAG";
widget.computeSize = () => [0, -4];  // Try to make it invisible
```

Result: Works 80% of the time, but:
• ComfyUI 2.0 rendering ignores `computeSize` in some cases
• Type corruption on save/load
• Inconsistent padding

**V2 Solution (Robust):**
```javascript
this.widgets = [controlWidget];  // Clear array
// Only add what we need
for (let i = 1; i <= count; i++) {
    this.widgets.push(cachedWidgets[i][0]);
    this.widgets.push(cachedWidgets[i][1]);
}
```

Result: Works 100% of the time because:
• `node.widgets` contains **only** visible widgets
• No hidden widgets to confuse rendering
• Height calculation is trivial (just count array length)

### Why Cached Widgets Don't Lose Values

**Common Misconception:**
"If you remove a widget from `node.widgets`, its value is lost."

**Truth:**
• Widget is a JavaScript object reference
• `cachedWidgets[i]` stores the reference
• Object still exists in memory (not garbage collected)
• When re-added to `node.widgets`, object is unchanged
• User-selected values persist in widget object

**Proof:**
```javascript
// Initial state
node.widgets = [control, lora1_name, lora1_wt, lora2_name, lora2_wt];
lora2_name.value = "my_lora.safetensors";  // User selects LoRA

// User reduces to 1 slot
node.widgets = [control, lora1_name, lora1_wt];  // lora2 removed from array

// BUT lora2_name object still exists!
cachedWidgets[2][0].value === "my_lora.safetensors"  // TRUE

// User increases to 2 slots
node.widgets = [control, lora1_name, lora1_wt, lora2_name, lora2_wt];  // lora2 restored

// Value automatically restored!
lora2_name.value === "my_lora.safetensors"  // TRUE
```

---

## Conclusion

v1.14 represents a **maturation** of the ComfyUI-NunchakuFluxLoraStacker project:
• Test nodes removed
• Production node (V2) refined and stable
• Codebase cleaned and simplified
• User experience streamlined

**For users:** Cleaner, simpler, better.
**For developers:** Less code, easier maintenance, professional quality.

---

**Repository:** https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker
**Release:** v1.14
**Date:** December 4, 2025
