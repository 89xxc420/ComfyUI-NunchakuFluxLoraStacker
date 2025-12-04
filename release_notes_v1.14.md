**Release Date:** December 4, 2025

**Major Changes:**
• Removed test nodes (x1-x9)
• Keep only FLUX LoRA Loader V2 (x10) with dynamic slot control
• Cleaner node selection in ComfyUI interface
• Updated version to 1.14

---

## 1. Purpose of This Release

### Problem: Too Many Similar Nodes

**Issue:**
Previous versions (v1.13 and earlier) generated 10 separate nodes in the Python backend:
- `FLUX LoRA Loader (x1)` - Fixed 1 slot
- `FLUX LoRA Loader (x2)` - Fixed 2 slots
- `FLUX LoRA Loader (x3)` - Fixed 3 slots
- ... (x4 through x9)
- `FLUX LoRA Loader V2` - Dynamic 1-10 slots (x10)

**Impact:**
- Cluttered node selection menu in ComfyUI
- Confusion for users: "Which node should I use?"
- The fixed-slot nodes (x1-x9) were originally created for **testing purposes only**
- Once V2 (x10) with dynamic slot control was completed, x1-x9 became redundant

### Solution: Keep Only V2

**v1.14 Changes:**
1. Removed node generation for `FluxLoraMultiLoader_1` through `FluxLoraMultiLoader_9`
2. Keep only `FluxLoraMultiLoader_10` (FLUX LoRA Loader V2)
3. Updated `pyproject.toml` version to `1.14`
4. No changes to JavaScript files or functionality

**Result:**
- Clean node menu with only the V2 node
- All functionality preserved (V2 supports 1-10 slots via dropdown)
- Simplified user experience

---

## 2. Technical Changes

### Modified File: `nodes/lora/flux_v2.py`

**Before (v1.13):**
```python
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
```

**After (v1.14):**
```python
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

**Changes:**
- Removed loop generating 10 nodes
- Directly generate only `FluxLoraMultiLoader_10`
- All other code unchanged (base class, logic, etc.)

### Modified File: `pyproject.toml`

**Change:**
```python
version = "1.13"  →  version = "1.14"
```

---

## 3. Why x1-x9 Were Test Nodes

### Development History

**Phase 1: Testing Fixed-Slot Nodes**
- Initially, x1-x9 were created to test different slot counts
- Each node had a fixed number of LoRA slots
- This helped verify the backend logic worked correctly

**Phase 2: V2 Development**
- `FluxLoraMultiLoader_10` was developed with **dynamic slot control**
- JavaScript UI allows changing slot count from 1 to 10 via dropdown
- Physical widget reconstruction ensures clean layout
- Python backend uses `optional` inputs to support dynamic removal

**Phase 3: V2 Completion (v1.12)**
- V2 was completed and fully functional
- x1-x9 became redundant
- However, they remained in code for backward compatibility testing

**Phase 4: Cleanup (v1.14)**
- Testing phase complete
- x1-x9 confirmed unnecessary
- Removed to simplify codebase and user experience

---

## 4. Migration Guide

### For New Users
Simply install v1.14. You will see only one node: **FLUX LoRA Loader V2**

### For Existing Users (v1.13 or Earlier)

**Impact on Existing Workflows:**

**If your workflow uses:**
- `FLUX LoRA Loader V2` (x10) → **No changes needed, works identically**
- `FLUX LoRA Loader (x1)` through `(x9)` → **Nodes will show as "missing"**

**Migration Steps for x1-x9 Users:**

1. **Identify affected workflows:**
   - Open workflows in a text editor
   - Search for `"class_type": "FluxLoraMultiLoader_1"` through `FluxLoraMultiLoader_9`

2. **Replace with V2:**
   - Open workflow in ComfyUI (nodes will show as red/missing)
   - Delete the missing node
   - Add `FLUX LoRA Loader V2` node
   - Set dropdown to match your original slot count
   - Reconnect wires
   - Save workflow

3. **Alternative (Manual JSON Edit):**
   ```json
   // Change this:
   "class_type": "FluxLoraMultiLoader_3"
   
   // To this:
   "class_type": "FluxLoraMultiLoader_10"
   
   // And add to widgets_values:
   "widgets_values": ["3", ...]  // First value is slot count
   ```

**Recommendation:**
- V2 is more flexible and maintained
- Fixed-slot nodes were never intended for production use

---

## 5. No Functional Changes

**Important:** v1.14 has **zero functional changes** from v1.13 for V2 users.

This is a **cleanup release** focused solely on:
- Removing redundant test nodes
- Simplifying node selection
- Cleaner codebase

**All V2 features work identically:**
- Dynamic 1-10 slot control via dropdown
- Physical widget reconstruction for clean layout
- `optional` inputs for validation-free dynamic UI
- `onConfigure` for workflow persistence
- Combo box at top of node

**If you are using FLUX LoRA Loader V2 (x10) without issues, upgrading to v1.14 is optional but recommended for cleaner installs.**

---

## 6. Node Comparison

| Version | Node Count | Node Names | Flexibility |
|---------|------------|------------|-------------|
| v1.12 and earlier | 10 nodes | x1, x2, x3, ..., x9, V2 (x10) | Fixed (x1-x9), Dynamic (V2) |
| v1.13 | 10 nodes | x1, x2, x3, ..., x9, V2 (x10) | Fixed (x1-x9), Dynamic (V2) |
| **v1.14** | **1 node** | **V2 (x10) only** | **Dynamic 1-10** |

**V2 Advantages:**
- ✅ Single node does the job of all 10 previous nodes
- ✅ Change slot count via dropdown without replacing node
- ✅ Cleaner workflow graphs
- ✅ Easier to maintain and update

---

## 7. Files Changed

### Modified Files (2 files)
1. `nodes/lora/flux_v2.py` - Node generation logic (removed x1-x9)
2. `pyproject.toml` - Version bump to 1.14

### Unchanged Files
- `js/z_flux_lora_dynamic.js` - No changes
- `js/fast_bypass_v2.js` - No changes
- `js/widgethider.js` - No changes (V1 backward compatibility)
- `README.md` - No changes needed (already documents V2)
- All other files - No changes

**Total changes:** 2 files, 14 insertions, 20 deletions

---

## 8. Verification

### How to Verify Installation

After installing v1.14:

**1. Check Node Menu:**
- Search for "FLUX LoRA"
- You should see **only 1 node**: `FLUX LoRA Loader V2`
- x1-x9 nodes should **not** appear

**2. Test V2 Node:**
- Add `FLUX LoRA Loader V2` to canvas
- Verify dropdown shows options: 1, 2, 3, ..., 10
- Change value and verify UI updates
- Save/load workflow to verify persistence

**3. Console Check:**
```
★★★ z_flux_lora_dynamic.js: RESTORE COMBO BOX + PHYSICAL DELETE (FINAL) ★★★
```

Should appear once on startup (no duplicates).

---

## 9. Backward Compatibility

### V1 Nodes (FLUX LoRA Loader)
**Status:** Unchanged, still available

If you use the original `FLUX LoRA Loader` node (not V2), it continues to work with `widgethider.js`.

### Existing V2 Workflows
**Status:** Fully compatible

All workflows using `FLUX LoRA Loader V2` work identically in v1.14.

### Workflows Using x1-x9
**Status:** Migration required

See "Migration Guide" section above.

---

## 10. Why This Cleanup Matters

### Before v1.14
- 10 nodes in menu
- Users confused about which to use
- Test nodes mixed with production nodes
- Maintenance burden for all 10 nodes

### After v1.14
- 1 node in menu (V2)
- Clear choice for users
- Only production-ready code
- Single node to maintain and improve

**Result:**
- Better user experience
- Cleaner codebase
- Easier future development
- Professional node organization

---

## Summary

v1.14 is a **cleanup release** that:
- ✅ Removes test nodes (x1-x9)
- ✅ Keeps only production V2 node (x10)
- ✅ Simplifies node selection
- ✅ Maintains full functionality

**Recommended for:**
- All new users (cleaner experience)
- Existing V2 users (optional upgrade)
- Users experiencing node menu clutter

**Migration required for:**
- Users with workflows using x1-x9 nodes

---

For questions or issues, please open a GitHub issue:
https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker/issues

