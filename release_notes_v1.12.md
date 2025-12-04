**Release Date:** December 4, 2025

**Major Changes:**
- Added FLUX LoRA Loader V2 with dynamic combo box UI (`FluxLoraMultiLoader_1` to `FluxLoraMultiLoader_10`)
- Ported Fast Groups Bypasser V2 from rgthree-comfy
- Modified input architecture to support ComfyUI Nodes 2.0 (Desktop)

---

## 1. Why V2 Was Necessary

### Root Cause: ComfyUI Nodes 2.0 Incompatibility

**Problem:**
ComfyUI Nodes 2.0 (Desktop version) introduced breaking changes to widget management and node serialization that made V1's dynamic UI implementation (`widgethider.js`) unreliable and error-prone.

**Specific Issues with V1:**
1. **Widget Type Manipulation Issues**: Using `HIDDEN_TAG` type override caused serialization problems where hidden widgets would be saved with incorrect types and fail to restore properly
2. **Height Calculation Instability**: Node height would not update correctly when widget count changed, leaving excessive padding
3. **Validation Errors**: Required inputs marked as hidden caused "Required input is missing" errors on workflow execution
4. **Save/Load Inconsistency**: Widget states would not persist correctly across workflow saves/loads

### Why V1 is Still Included

V1 (`NunchakuFluxLoraStack`) remains for:
- **Backward Compatibility**: Users on ComfyUI 1.x can continue using existing workflows
- **Feature Preservation**: V1's `input_mode` (simple/advanced) toggle is still useful
- **Gradual Migration**: Allows users to transition at their own pace

---

## 2. Files Modified

### 2.1 `js/z_flux_lora_dynamic.js` (NEW FILE)

**Purpose:** Dynamic UI controller for `FluxLoraMultiLoader_10` node

**Key Changes:**
- Physical widget reconstruction instead of type manipulation
- Combo box selector for slot count (1-10)
- Manual height calculation based on visible slots
- Cached widget system for value persistence

### 2.2 `nodes/lora/flux_v2.py` (MODIFIED)

**Purpose:** Python node definitions for V2 LoRA loaders

**Key Changes:**
- Changed all `lora_name_X` and `lora_wt_X` inputs from `required` to `optional`
- This prevents validation errors when widgets are physically removed from UI

**Lines Modified:** 37-40

### 2.3 `README.md` (MODIFIED)

**Purpose:** Documentation update

**Key Changes:**
- Added V2 nodes section with detailed usage instructions
- Documented why V2 was necessary (ComfyUI Nodes 2.0 compatibility)
- Documented why V1 is preserved (backward compatibility)
- Added credits and links to original implementations (rgthree-comfy, efficiency-nodes-comfyui)

---

## 3. Technical Deep Dive

### 3.1 Problem: Widget Visibility and Validation Errors

**V1 Approach (Failed in Nodes 2.0):**
```javascript
// V1: Type manipulation with HIDDEN_TAG
widget.type = show ? origType : HIDDEN_TAG;
widget.computeSize = show ? origComputeSize : () => [0, -4];
```

**Problems:**
1. When `serialize_widgets = false`: Widget values not saved → Validation errors on load
2. When `serialize_widgets = true`: Hidden widgets saved with `HIDDEN_TAG` type → Cannot restore to original type
3. Node height calculation includes hidden widgets → Excessive padding

**V2 Approach (Solution):**
```javascript
// V2: Physical widget array reconstruction
node.updateLoraSlots = function() {
    const count = parseInt(this.properties["visibleLoraCount"] || 1);
    const controlWidget = ensureControlWidget();
    
    // Rebuild widgets array with only visible slots
    this.widgets = [controlWidget];
    
    for (let i = 1; i <= count; i++) {
        const pair = this.cachedWidgets[i];
        if (pair) {
            this.widgets.push(pair[0]); // lora_name
            this.widgets.push(pair[1]); // lora_wt
        }
    }
    
    // Manual height calculation
    const HEADER_H = 60;
    const SLOT_H = 54; // lora_name (26px) + lora_wt (26px) + margin
    const PADDING = 20;
    const targetH = HEADER_H + (count * SLOT_H) + PADDING;
    
    this.setSize([this.size[0], targetH]);
};
```

**Why This Works:**
- Widgets not in `node.widgets` array are not rendered → No visual artifacts
- Widgets not in array don't contribute to height → No padding waste
- Cached widget objects retain their values → Persistence across slot count changes
- Physical removal means LiteGraph cannot interfere with sizing

### 3.2 Problem: Required Input Validation Errors

**Error Message:**
```
Failed to validate prompt for output 9:
* FluxLoraMultiLoader_10 204:
  - Required input is missing: lora_name_5
  - Required input is missing: lora_wt_5
  ...
```

**Root Cause:**
When widgets are physically removed from `node.widgets` array, their values are not sent to the backend. ComfyUI's validation layer checks that all `required` inputs have values, causing the error.

**Solution:**

**Before (`flux_v2.py` lines 37-40):**
```python
for i in range(1, cls._slot_count + 1):
    inputs["required"][f"lora_name_{i}"] = (loras, {"tooltip": f"LoRA {i} filename"})
    inputs["required"][f"lora_wt_{i}"] = ("FLOAT", {"default": 1.0, "step": 0.001, "tooltip": f"LoRA {i} Strength"})
```

**After (`flux_v2.py` lines 37-40):**
```python
for i in range(1, cls._slot_count + 1):
    inputs["optional"][f"lora_name_{i}"] = (loras, {"tooltip": f"LoRA {i} filename"})
    inputs["optional"][f"lora_wt_{i}"] = ("FLOAT", {"default": 1.0, "step": 0.001, "tooltip": f"LoRA {i} Strength"})
```

**Why This Works:**
- Optional inputs don't cause validation errors when missing
- Backend handles missing optional inputs gracefully (uses default values or skips)
- `load_lora_stack()` already checks `if not lora_name or lora_name == "None": continue` → Safe for optional inputs

### 3.3 Feature: Combo Box Selector

**User Request:**
Replace manual input button (`prompt()` dialog) with dropdown selector for better UX.

**Implementation:**
```javascript
const ensureControlWidget = () => {
    const name = "🔢 LoRA Count";
    
    // Remove legacy button widgets
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

**Benefits:**
- One-click selection vs typing number
- No risk of invalid input (dropdown constrains to 1-10)
- Immediate visual feedback when selection changes

### 3.4 Feature: Widget Caching for Value Persistence

**Challenge:**
When widgets are physically removed from array, their values could be lost.

**Solution:**
```javascript
const initCache = () => {
    if (cacheReady) return;
    const all = [...node.widgets];
    for (let i = 1; i <= 10; i++) {
        const wName = all.find(w => w.name === `lora_name_${i}`);
        const wWt = all.find(w => w.name === `lora_wt_${i}`);
        if (wName && wWt) {
            node.cachedWidgets[i] = [wName, wWt];
            // Ensure correct types
            wName.type = "combo";
            wWt.type = "number";
        }
    }
    cacheReady = true;
};
```

**How It Works:**
1. On node creation, all 10 slots' widget objects are cached in `node.cachedWidgets`
2. Widget objects are JavaScript references → Values are preserved even when removed from array
3. When slot count increases, cached widgets are pushed back into `node.widgets` array
4. User's LoRA selections and strength values are retained

---

## 4. Complete Code Changes

### 4.1 New File: `js/z_flux_lora_dynamic.js`

```javascript
import { app } from "../../scripts/app.js";

console.log("★★★ z_flux_lora_dynamic.js: RESTORE COMBO BOX + PHYSICAL DELETE (FINAL) ★★★");

app.registerExtension({
    name: "nunchaku.flux_lora_dynamic_combo_final_restore",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "FluxLoraMultiLoader_10") {
            nodeType["@visibleLoraCount"] = { type: "number", default: 1, min: 1, max: 10, step: 1 };
        }
    },

    nodeCreated(node) {
        if (node.comfyClass !== "FluxLoraMultiLoader_10") return;

        // node.serialize_widgets = false;
        if (!node.properties) node.properties = {};
        if (node.properties["visibleLoraCount"] === undefined) node.properties["visibleLoraCount"] = 1;

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

        node.updateLoraSlots = function() {
            if (!cacheReady) initCache();

            const count = parseInt(this.properties["visibleLoraCount"] || 1);
            const controlWidget = ensureControlWidget();

            // Physical widget reconstruction for clean layout
            this.widgets = [controlWidget];

            for (let i = 1; i <= count; i++) {
                const pair = this.cachedWidgets[i];
                if (pair) {
                    this.widgets.push(pair[0]); 
                    this.widgets.push(pair[1]);
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

        node.onPropertyChanged = function(property, value) {
            if (property === "visibleLoraCount") {
                const w = this.widgets.find(x => x.name === "🔢 LoRA Count");
                if (w) w.value = value.toString();
                this.updateLoraSlots();
            }
        };
        
        // Restore UI on configure
        const origOnConfigure = node.onConfigure;
        node.onConfigure = function() {
             if (origOnConfigure) origOnConfigure.apply(this, arguments);
             setTimeout(() => node.updateLoraSlots(), 100);
        };

        setTimeout(() => {
            initCache();
            node.updateLoraSlots();
        }, 100);
    }
});
```

---

### 4.2 Modified: `nodes/lora/flux_v2.py`

**Lines 37-40 (Before):**
```python
for i in range(1, cls._slot_count + 1):
    inputs["required"][f"lora_name_{i}"] = (loras, {"tooltip": f"LoRA {i} filename"})
    inputs["required"][f"lora_wt_{i}"] = ("FLOAT", {"default": 1.0, "step": 0.001, "tooltip": f"LoRA {i} Strength"})
```

**Lines 37-40 (After):**
```python
for i in range(1, cls._slot_count + 1):
    inputs["optional"][f"lora_name_{i}"] = (loras, {"tooltip": f"LoRA {i} filename"})
    inputs["optional"][f"lora_wt_{i}"] = ("FLOAT", {"default": 1.0, "step": 0.001, "tooltip": f"LoRA {i} Strength"})
```

**Reason:**
Changed from `required` to `optional` to prevent validation errors when widgets are physically removed from UI via JavaScript. Backend `load_lora_stack()` already handles missing inputs gracefully via `kwargs.get()` with defaults.

---

## 5. Architecture: Physical Widget Reconstruction

### 5.1 The Core Principle

**Traditional Approach (V1):**
- Keep all widgets in `node.widgets` array
- Hide unwanted widgets by changing `widget.type` to custom hidden type
- Override `widget.computeSize()` to return `[0, -4]` for height suppression

**Problems:**
- Hidden widgets still exist in array → ComfyUI's internal sizing logic may count them
- Type manipulation causes serialization issues
- Restoring original types is unreliable

**V2 Approach (Physical Reconstruction):**
- Cache all widget objects on initialization
- Rebuild `node.widgets` array on every slot count change
- Only include control widget + visible slot widgets in array
- Height automatically matches array contents

**Code Flow:**
```
User selects "3" from combo box
  ↓
node.properties["visibleLoraCount"] = 3
  ↓
node.updateLoraSlots() called
  ↓
node.widgets = [controlWidget] (clear array)
  ↓
Push cachedWidgets[1], cachedWidgets[2], cachedWidgets[3] into array
  ↓
Calculate height: 60 + (3 × 54) + 20 = 242px
  ↓
node.setSize([width, 242])
  ↓
Canvas redraws with exactly 3 slots visible, no padding
```

### 5.2 Why Widgets Not in Array Don't Cause Validation Errors

**Question:** If widgets are removed from array, won't Python complain about missing required inputs?

**Answer:** Yes, which is why we changed inputs to `optional` in Python.

**Backend Behavior:**
```python
def load_lora_stack(self, model, **kwargs):
    for i in range(1, self._slot_count + 1):
        lora_name = kwargs.get(f"lora_name_{i}")  # Returns None if missing
        if not lora_name or lora_name == "None":
            continue  # Skip this slot
        # ... apply LoRA ...
```

The `kwargs.get()` pattern means missing inputs are treated as `None` and skipped. No error is raised.

### 5.3 Widget Caching Strategy

**Challenge:** How to preserve widget values when they're removed from array?

**Solution:** JavaScript object references

```javascript
// Step 1: Cache on initialization
node.cachedWidgets[i] = [nameWidget, wtWidget];
// These are REFERENCES to widget objects, not copies

// Step 2: Remove from array
node.widgets = [controlWidget]; // Slots 4-10 are not in array

// Step 3: But cached references still point to same objects
// nameWidget.value and wtWidget.value are still accessible

// Step 4: Add back to array when slot count increases
node.widgets.push(node.cachedWidgets[4][0]); // Same object, value preserved!
```

**Result:** User selects LoRA in slot 5, changes count to 3, then back to 5 → Slot 5 still has the same LoRA selected.

---

## 6. Height Calculation Deep Dive

### 6.1 Manual Height Formula

```javascript
const HEADER_H = 60;   // Node header + combo box area
const SLOT_H = 54;     // Per-slot height (combo 26px + number 26px + margin 2px)
const PADDING = 20;    // Bottom padding
const targetH = HEADER_H + (count * SLOT_H) + PADDING;
```

**Example:**
- Slot count = 1: `60 + (1 × 54) + 20 = 134px`
- Slot count = 5: `60 + (5 × 54) + 20 = 350px`
- Slot count = 10: `60 + (10 × 54) + 20 = 620px`

### 6.2 Why Not Use `node.computeSize()`?

**Attempted in earlier versions:**
```javascript
node.computeSize = function() {
    // Calculate height based on visible widgets
    let h = 60;
    for (const w of this.widgets) {
        if (!w.type.startsWith(HIDDEN_TAG)) {
            h += w.computeSize()[1] + 4;
        }
    }
    return [this.size[0], h];
};
```

**Problem:**
LiteGraph's internal resize logic sometimes overrides `computeSize()` results, especially during serialization/deserialization cycles. Manual formula is more reliable.

**V2 Solution:**
Don't override `computeSize()`. Instead, directly call `setSize()` with calculated value after every widget reconstruction. This bypasses LiteGraph's auto-calculation entirely.

---

## 7. Combo Box UI Implementation

### 7.1 Why Combo Box Instead of Button?

**Old (Button with prompt):**
```javascript
const btn = node.addWidget("button", "🔢 Set LoRA Count", null, () => {
    const val = prompt("Enter LoRA Count (1-10):", current);
    // ... parse and validate ...
});
```

**Problems:**
- Requires typing → Error-prone
- Extra click to dismiss dialog
- No visual indication of current value

**New (Combo Box):**
```javascript
const values = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const combo = node.addWidget("combo", "🔢 LoRA Count", "1", (v) => {
    const num = parseInt(v);
    node.properties["visibleLoraCount"] = num;
    node.updateLoraSlots();
}, { values });
```

**Benefits:**
- Single click selection
- Constrained to valid range
- Current value always visible
- Standard ComfyUI UX pattern

### 7.2 Button Cleanup Logic

**Challenge:** Legacy workflows may have old button widgets saved.

**Solution:**
```javascript
// Aggressive cleanup on every updateLoraSlots() call
for (let i = node.widgets.length - 1; i >= 0; i--) {
    const w = node.widgets[i];
    if (w.name === "🔢 Set LoRA Count" || w.type === "button") {
        node.widgets.splice(i, 1);
    }
}
```

This ensures combo box is the only control widget, even when loading old workflows.

---

## 8. Fast Groups Bypasser V2

### 8.1 Origin and Purpose

**Source:** Ported from [rgthree-comfy](https://github.com/rgthree/rgthree-comfy)

**Purpose:** Group-based node bypass control (unrelated to LoRA functionality)

**Why Included:**
Utility feature for workflow management. Allows toggling entire node groups on/off based on color/title filters.

**Key Features:**
- Color-based group filtering
- Title regex filtering
- Position/alphanumeric/custom sorting
- Bypass vs Mute modes
- Restriction modes (default/max one/always one)

### 8.2 Implementation File

**File:** `js/fast_bypass_v2.js`

**Note:** This file uses the same widget reconstruction pattern as LoRA Loader V2:
```javascript
node.refreshWidgets = function() {
    // ... filter and sort groups ...
    
    // Rebuild widget array
    let index = this.fixedWidgetsCount || 0;
    for (const group of filteredGroups) {
        // Add or reuse toggle widget
        // ...
    }
    
    // Remove excess widgets
    while (this.widgets[index]) {
        this.removeWidget(this.widgets[index]);
    }
    
    // Resize to fit
    this.setSize(this.computeSize());
};
```

This pattern was adapted and refined for LoRA Loader V2.

---

## 9. Migration Guide: V1 to V2

### 9.1 For Users

**If using `NunchakuFluxLoraStack` (V1):**
1. V1 node still works in ComfyUI 1.x
2. For ComfyUI Nodes 2.0, use `FluxLoraMultiLoader_10` instead
3. Key differences:
   - No `input_mode` (simple/advanced) toggle in V2
   - Use `🔢 LoRA Count` combo box instead of `lora_count` widget
   - V2 only has `lora_name_X` and `lora_wt_X` (no `model_str_X`/`clip_str_X`)

**Recommended Migration Path:**
1. Keep existing V1 workflows functional
2. Create new workflows using V2 nodes
3. Test thoroughly before switching production workflows

### 9.2 For Developers

**Key Architectural Changes:**

| Aspect | V1 | V2 |
|--------|----|----|
| Widget Hiding | Type manipulation (`HIDDEN_TAG`) | Physical array reconstruction |
| Height Calculation | Override `computeSize()` | Direct `setSize()` with formula |
| Input Definition | `required` | `optional` |
| Slot Control | `lora_count` widget | `visibleLoraCount` property + combo box |
| Serialization | `serialize_widgets = false` | Default (`true`) |

---

## 10. Known Limitations and Future Work

### 10.1 Current Limitations

1. **No Simple/Advanced Mode Toggle**: V2 removed `input_mode` to simplify architecture. All slots use single `lora_wt` strength.
2. **FluxLoraMultiLoader_10 Only**: Dynamic UI currently only implemented for x10 variant. Other variants (x1-x9) use standard static UI.
3. **No Workflow Auto-Migration**: Users must manually recreate workflows when switching from V1 to V2.

### 10.2 Future Enhancements

1. **Extend Dynamic UI to All Variants**: Apply physical reconstruction pattern to x1-x9 nodes
2. **Slider Alternative**: Option to use slider widget instead of combo box for slot count
3. **Preset Management**: Save/load LoRA configurations as presets
4. **Drag-and-Drop Reordering**: Allow reordering LoRA slots via drag-and-drop

---

## 11. Testing Checklist

### 11.1 Functionality Tests

- [x] Combo box displays values 1-10
- [x] Selecting different values changes visible slot count immediately
- [x] Node height adjusts correctly (no excessive padding)
- [x] Workflow saves and loads with correct slot count and LoRA selections
- [x] No validation errors when executing with fewer than 10 slots
- [x] LoRA strengths default to 1.0
- [x] "None" LoRA selections are skipped correctly

### 11.2 Edge Case Tests

- [x] Switching from 10 slots to 1 slot and back preserves all LoRA selections
- [x] Reloading browser maintains slot count and selections
- [x] Multiple `FluxLoraMultiLoader_10` nodes on same canvas work independently
- [x] Works correctly when node is copy-pasted
- [x] Works correctly when workflow is imported from JSON

### 11.3 Performance Tests

- [x] No memory leaks from widget caching
- [x] No performance degradation with multiple slot count changes
- [x] Canvas redraw performance remains smooth

---

## 12. Credits and Acknowledgments

**Original Implementations:**
- Dynamic widget hiding pattern: [efficiency-nodes-comfyui](https://github.com/jags111/efficiency-nodes-comfyui)
- Fast Groups Bypasser: [rgthree-comfy](https://github.com/rgthree/rgthree-comfy)

**V2 Adaptations:**
- Physical widget reconstruction approach
- Combo box UI control
- Manual height calculation formula
- Optional input architecture

---

## 13. Summary

v1.12 introduces V2 nodes designed specifically for **ComfyUI Nodes 2.0 compatibility**, addressing critical issues with dynamic widget management, serialization, and validation that plagued V1 in the new environment.

**Key Achievements:**
1. ✅ **Zero Padding Waste**: Node height precisely matches visible slots
2. ✅ **No Validation Errors**: Optional inputs allow physical widget removal without backend errors
3. ✅ **Combo Box UX**: One-click slot count selection
4. ✅ **Value Persistence**: Widget caching preserves user selections across count changes
5. ✅ **Workflow Compatibility**: Saves and loads correctly without state corruption

**Breaking Changes:**
- V1 `input_mode` removed in V2
- V1 `lora_count` widget replaced with `visibleLoraCount` property + combo box

**Migration:** V1 remains available for backward compatibility. Users should test V2 thoroughly before migrating production workflows.

