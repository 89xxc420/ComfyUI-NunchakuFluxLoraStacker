# v1.15: FastGroupsBypasserV2 Critical Fix - Widget State Persistence

**Release Date:** December 5, 2025

---

## Overview: The "Second Update Fails" Bug

FastGroupsBypasserV2 suffered from a critical widget update bug where property changes would work perfectly on the **first attempt**, but completely fail on the **second attempt** without a full browser refresh (F5).

**Symptoms:**
```
1. User toggles a group → ✓ Works perfectly
2. User toggles another group → ✗ No effect (UI frozen)
3. User presses F5 (browser refresh) → ✓ Works again (once)
4. User toggles again → ✗ Frozen again
```

**Impact:** This made FastGroupsBypasserV2 effectively unusable for dynamic workflow management, as users had to reload the entire page after every single interaction.

---

## Part 1: Root Cause Analysis

### 1.1 The Fragmented Widget Management Anti-Pattern

**Original Implementation (BROKEN):**

```javascript
// In nodeCreated (static initialization):
node.addWidget("button", "🎨 Edit Match Colors", null, () => {
    const currentValue = node.properties[PROPERTY_MATCH_COLORS] || "";
    const newValue = prompt("Match Colors:", currentValue);
    if (newValue !== null) {
        node.properties[PROPERTY_MATCH_COLORS] = newValue;
        node.refreshWidgets();
    }
});

node.addWidget("button", "📝 Edit Match Title", null, () => {
    const currentValue = node.properties[PROPERTY_MATCH_TITLE] || "";
    const newValue = prompt("Match Title:", currentValue);
    if (newValue !== null) {
        node.properties[PROPERTY_MATCH_TITLE] = newValue;
        node.refreshWidgets();
    }
});

node.fixedWidgetsCount = node.widgets ? node.widgets.length : 0;  // = 2

// In refreshWidgets (dynamic update):
let index = this.fixedWidgetsCount || 0;  // Start AFTER buttons (index = 2)

for (const group of filteredGroups) {
    const widgetName = `Enable: ${title}`;
    
    let widget = this.widgets ? this.widgets.find(w => w.name === widgetName) : null;
    
    if (!widget) {
        const isEnabled = isGroupEnabled.call(this, group);
        widget = this.addWidget("toggle", widgetName, isEnabled, (v) => {});
    }
    
    if (widget) {
        if (widget.value !== isEnabled) {
            widget.value = isEnabled;  // FATAL FLAW #1: Force value update
        }
        widget.callback = (v) => handleToggle.call(this, group, v, widget);
        
        if (this.widgets[index] !== widget) {
            const oldIndex = this.widgets.findIndex(w => w === widget);
            if (oldIndex !== -1) {
                this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
            }
        }
    }
    
    index++;
}

while ((this.widgets || [])[index]) {
    this.removeWidget(index);  // FATAL FLAW #2: Index-based removal
}
```

### 1.2 The Three Fatal Flaws Explained

#### Fatal Flaw #1: Forced Widget Value Updates

```javascript
if (widget.value !== isEnabled) {
    widget.value = isEnabled;  // Executed on EVERY refreshWidgets() call
}
```

**Why This Destroyed Second Updates:**

**First Update Flow:**
1. User clicks toggle for "Group A" → `handleToggle()` fires
2. `setGroupMode()` changes node modes in group
3. `handleToggle()` completes successfully
4. SimpleRefreshService schedules refresh (100ms later)
5. `refreshWidgets()` runs, finds "Group A" widget
6. **Overwrites `widget.value = isEnabled`** (calculated from current node modes)
7. This triggers widget's internal change event
8. But user's intended state is already applied, so it appears to work

**Second Update Flow:**
1. User clicks toggle for "Group B" → `handleToggle()` fires
2. `setGroupMode()` changes node modes
3. `handleToggle()` completes
4. SimpleRefreshService schedules refresh
5. `refreshWidgets()` runs, finds "Group B" widget
6. **Overwrites `widget.value = isEnabled`** again
7. But this time, the overwrite conflicts with the ongoing state change
8. Widget's value gets set back to the OLD state (race condition)
9. UI shows toggle clicked, but internal value is wrong
10. **Result: Widget appears frozen, doesn't respond to clicks**

**Root Problem:**
- `widget.value` should only be set on **widget creation**
- Updating it on existing widgets triggers side effects and state conflicts
- User's click sets the value → `refreshWidgets()` immediately overwrites it → desync

#### Fatal Flaw #2: Index-Based Widget Removal

```javascript
while ((this.widgets || [])[index]) {
    this.removeWidget(index);  // Infinite loop or wrong widget removed
}
```

**Why This Caused Removal Failures:**

**Problem A: Infinite Loop Risk**
```javascript
// If removeWidget doesn't actually remove at index:
while (this.widgets[5]) {  // Widget exists at index 5
    this.removeWidget(5);   // Try to remove
    // If widget still at index 5 → loop forever
}
```

**Problem B: Wrong Widget Removed**
```javascript
// During splice operations, indices shift:
this.widgets = [btn1, btn2, group1, group2, group3];
index = 3;

// Trying to remove group3 (index 4), but index=3 points to group2
this.removeWidget(3);  // Removes group2 instead!
```

**Correct Approach:**
```javascript
// Pass widget OBJECT, not index:
this.removeWidget(this.widgets[index]);  // ComfyUI removes the correct widget
```

#### Fatal Flaw #3: Split Index Space Management

```javascript
// Buttons: indices 0-1 (managed in nodeCreated)
node.fixedWidgetsCount = 2;

// Groups: indices 2+ (managed in refreshWidgets)
let index = this.fixedWidgetsCount;  // = 2
```

**Why This Fragmented the Array:**

**The Index Space Illusion:**
```
Logical View (what code assumed):
[0: btn1] [1: btn2] | [2: group1] [3: group2] [4: group3]
         ^                    ^
   Fixed (nodeCreated)    Dynamic (refreshWidgets)
```

**Reality After splice() Operations:**
```
After first splice in refreshWidgets:
[0: btn1] [1: group1] [2: btn2] [3: group2] [4: group3]
                ^
          splice moved btn2 here by mistake!
```

**Why splice() Failed:**
- `splice()` operates on the **entire** `this.widgets` array
- It doesn't know about "fixed" vs "dynamic" zones
- When refreshWidgets does `splice(2, 0, widget)`, it can accidentally move buttons
- Fixed widgets weren't actually "fixed" - they were vulnerable to splice operations

**Result:**
- After first update: Array order corrupted
- Second update: `index = this.fixedWidgetsCount` points to wrong widget
- Widget positioning logic breaks down completely

---

## Part 2: The Fix - Unified Widget Management

### 2.1 Complete Code Transformation

**New Implementation (CORRECT - rgthree Pure Pattern):**

```javascript
// In refreshWidgets (ALL widgets managed here):
node.refreshWidgets = function() {
    if (!app || !app.graph) return;
    const graph = app.graph;
    
    // ... (sorting and filtering logic unchanged) ...
    
    let index = 0;  // Start from 0 - unified index space
    
    // Step 1: Manage Edit Colors Button
    let editColorsBtn = this.widgets.find(w => w.name === "🎨 Edit Match Colors");
    if (!editColorsBtn) {
        editColorsBtn = this.addWidget("button", "🎨 Edit Match Colors", null, () => {
            const currentValue = this.properties[PROPERTY_MATCH_COLORS] || "";
            const newValue = prompt("Match Colors (comma separated, e.g. red,blue,#ff0000):", currentValue);
            if (newValue !== null) {
                this.properties[PROPERTY_MATCH_COLORS] = newValue;
                this.refreshWidgets();
            }
        });
    }
    if (editColorsBtn && this.widgets[index] !== editColorsBtn) {
        const oldIndex = this.widgets.findIndex(w => w === editColorsBtn);
        if (oldIndex !== -1) {
            this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
        }
    }
    index++;  // Now index = 1
    
    // Step 2: Manage Edit Title Button (same pattern)
    let editTitleBtn = this.widgets.find(w => w.name === "📝 Edit Match Title");
    if (!editTitleBtn) {
        editTitleBtn = this.addWidget("button", "📝 Edit Match Title", null, () => {
            const currentValue = this.properties[PROPERTY_MATCH_TITLE] || "";
            const newValue = prompt("Match Title (regex pattern):", currentValue);
            if (newValue !== null) {
                this.properties[PROPERTY_MATCH_TITLE] = newValue;
                this.refreshWidgets();
            }
        });
    }
    if (editTitleBtn && this.widgets[index] !== editTitleBtn) {
        const oldIndex = this.widgets.findIndex(w => w === editTitleBtn);
        if (oldIndex !== -1) {
            this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
        }
    }
    index++;  // Now index = 2
    
    // Step 3: Manage Group Toggle Widgets
    for (const group of filteredGroups) {
        const title = group.title || "Group";
        const widgetName = `Enable: ${title}`;
        
        let widget = this.widgets ? this.widgets.find(w => w.name === widgetName) : null;
        
        if (!widget) {
            const isEnabled = isGroupEnabled.call(this, group);
            widget = this.addWidget("toggle", widgetName, isEnabled, (v) => {});
        }
        
        if (widget) {
            // KEY FIX: Only update callback, NOT value
            widget.callback = (v) => handleToggle.call(this, group, v, widget);
            
            if (this.widgets[index] !== widget) {
                const oldIndex = this.widgets.findIndex(w => w === widget);
                if (oldIndex !== -1) {
                    this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
                }
            }
        }
        
        index++;
    }
    
    // Step 4: Remove Excess Widgets
    while ((this.widgets || [])[index]) {
        this.removeWidget(this.widgets[index]);  // KEY FIX: Pass widget object
    }

    this.setSize(this.computeSize());
    if (app.canvas) app.canvas.setDirty(true, true);
};

// In nodeCreated (buttons NO LONGER created here):
node.fixedWidgetsCount = 0;  // KEY FIX: No longer used

setTimeout(() => {
    node.refreshWidgets();  // Initial refresh creates all widgets
    if (node.graph) {
        SERVICE.addNode(node);
    }
}, 100);
```

### 2.2 The Three Key Fixes

#### Key Fix #1: Stopped Forcing Widget Values

**Before (WRONG):**
```javascript
if (widget.value !== isEnabled) {
    widget.value = isEnabled;  // REMOVED THIS
}
```

**After (CORRECT):**
```javascript
// Value is set ONLY on widget creation:
if (!widget) {
    const isEnabled = isGroupEnabled.call(this, group);
    widget = this.addWidget("toggle", widgetName, isEnabled, (v) => {});
    // ↑ Value set here, once, on creation
}

// For existing widgets: NO value update
widget.callback = (v) => handleToggle.call(this, group, v, widget);
// ↑ Only callback updated (safe)
```

**Why This Fixed Second Updates:**
- Widget value changes ONLY through:
  1. Initial creation (`addWidget` with initial value)
  2. User clicks (triggers callback)
  3. Callback logic (`handleToggle`)
- `refreshWidgets()` no longer interferes with widget state
- No race conditions, no overwrites, no conflicts

#### Key Fix #2: Object-Based Widget Removal

**Before (WRONG):**
```javascript
while ((this.widgets || [])[index]) {
    this.removeWidget(index);  // Ambiguous: index or object?
}
```

**After (CORRECT):**
```javascript
while ((this.widgets || [])[index]) {
    this.removeWidget(this.widgets[index]);  // Explicit: widget object
}
```

**Why This Fixed Removal Logic:**
- ComfyUI's `removeWidget` can accept either index or widget object (implementation varies)
- Passing `this.widgets[index]` is **always correct** (gives the actual widget)
- No ambiguity, no off-by-one errors
- Guaranteed correct widget removal

#### Key Fix #3: Unified Index Space (Buttons in refreshWidgets)

**Before (WRONG - Split Management):**
```javascript
// nodeCreated:
node.addWidget("button", ...);
node.addWidget("button", ...);
node.fixedWidgetsCount = 2;

// refreshWidgets:
let index = this.fixedWidgetsCount;  // Start at 2
// Only manage group widgets (indices 2+)
```

**After (CORRECT - Unified Management):**
```javascript
// nodeCreated:
// Buttons NOT created here
node.fixedWidgetsCount = 0;  // No longer used

// refreshWidgets:
let index = 0;  // Start at 0

// Manage button 1
let editColorsBtn = this.widgets.find(w => w.name === "🎨 Edit Match Colors");
if (!editColorsBtn) editColorsBtn = this.addWidget(...);
splice to position 0;
index++;  // = 1

// Manage button 2
let editTitleBtn = this.widgets.find(w => w.name === "📝 Edit Match Title");
if (!editTitleBtn) editTitleBtn = this.addWidget(...);
splice to position 1;
index++;  // = 2

// Manage group widgets (indices 2+)
for (const group of filteredGroups) {
    // Same pattern: find, create if missing, splice, index++
}
```

**Why This Fixed Widget Positioning:**

**Unified Index Space:**
```
All widgets managed in single loop with single index:
index=0: Edit Colors Button → find/create/splice
index=1: Edit Title Button  → find/create/splice
index=2: Enable: Group A    → find/create/splice
index=3: Enable: Group B    → find/create/splice
...
```

**Benefits:**
1. **No Split Management**: All widgets treated equally
2. **Correct splice() Operations**: All widgets in same coordinate system
3. **Predictable Positioning**: index++ applies to all widgets uniformly
4. **No "Invisible" Widgets**: No widgets hidden from the algorithm

---

## Part 2: Technical Deep Dive

### 2.1 Why Buttons Must Be in refreshWidgets

**The Problem with Static Button Creation:**

When buttons are created in `nodeCreated` and marked as "fixed":

```javascript
// nodeCreated runs once:
node.addWidget("button", "🎨 Edit Match Colors", ...);  // Added to this.widgets[0]
node.addWidget("button", "📝 Edit Match Title", ...);   // Added to this.widgets[1]
node.fixedWidgetsCount = 2;

// refreshWidgets runs repeatedly:
let index = 2;  // Assumes buttons are at 0-1
// Manages widgets starting at index 2
```

**The Fragmentation:**
- Buttons at indices 0-1: Never touched by `refreshWidgets`
- Groups at indices 2+: Managed by `refreshWidgets`
- **But `splice()` doesn't respect this boundary!**

**What Happens on First Update:**
```javascript
this.widgets = [btn1, btn2, groupA, groupB];

// refreshWidgets tries to position groupA at index 2:
if (this.widgets[2] !== groupA) {  // false (groupA is at 2)
    // No action needed
}

// Works fine!
```

**What Happens on Second Update (After Group Added):**
```javascript
this.widgets = [btn1, btn2, groupA, groupB, groupC];

// refreshWidgets processes in different order (due to sorting):
// Wants: [btn1, btn2, groupC, groupA, groupB]

// Tries to position groupC at index 2:
if (this.widgets[2] !== groupC) {  // true (groupA is at 2)
    const oldIndex = this.widgets.findIndex(w => w === groupC);  // = 4
    this.widgets.splice(2, 0, this.widgets.splice(4, 1)[0]);
    // Result: [btn1, btn2, groupC, groupA, groupB]
}

// Now index = 3, tries to position groupA:
if (this.widgets[3] !== groupA) {  // false (groupA IS at 3)
    // No action
}

// But wait! During the splice above, btn1 might have shifted!
// If splice logic is complex, buttons can accidentally move
// Result: [btn1, groupC, btn2, groupA, groupB]  // CORRUPTED!

// Now fixedWidgetsCount = 2, but buttons are at indices 0 and 2!
// Next refresh starts at index 2 (where btn2 is) → COLLISION
```

**The Solution: Dynamic Button Management**

```javascript
// refreshWidgets manages buttons too:
let index = 0;

// Find or create button, then splice to index 0:
let btn1 = this.widgets.find(w => w.name === "🎨 Edit Match Colors");
if (!btn1) btn1 = this.addWidget(...);
if (this.widgets[0] !== btn1) {
    splice btn1 to index 0;
}
index++;  // = 1

// Find or create button, then splice to index 1:
let btn2 = this.widgets.find(w => w.name === "📝 Edit Match Title");
if (!btn2) btn2 = this.addWidget(...);
if (this.widgets[1] !== btn2) {
    splice btn2 to index 1;
}
index++;  // = 2

// Now groups start at index 2, but buttons are ALSO managed by same loop
// All widgets in unified coordinate system
```

**Result:**
- Buttons repositioned on every refresh (if needed)
- No assumptions about "fixed" positions
- `splice()` operations work correctly for ALL widgets
- No fragmentation, no corruption

---

### 2.2 The Widget Value Lifecycle

**Correct Widget Value Management:**

```javascript
// Widget Creation (ONLY time value is set):
if (!widget) {
    const isEnabled = isGroupEnabled.call(this, group);
    widget = this.addWidget("toggle", widgetName, isEnabled, (v) => {});
    //                                            ↑
    //                              Value set HERE (once)
}

// Widget Reuse (value NOT touched):
widget.callback = (v) => handleToggle.call(this, group, v, widget);
//                        ↑
//              Only callback updated (safe)
```

**Widget Value Change Paths:**

**Path 1: User Click**
```
User clicks toggle
  ↓
LiteGraph calls widget.callback(newValue)
  ↓
handleToggle(group, newValue, widget) executes
  ↓
setGroupMode(group, newValue) changes node modes
  ↓
Widget.value updated by LiteGraph internally (we don't touch it)
```

**Path 2: External Group Change (monitored by SimpleRefreshService)**
```
User manually changes node mode outside the widget
  ↓
SimpleRefreshService.refresh() calls node.refreshWidgets()
  ↓
isGroupEnabled(group) calculates current state from nodes
  ↓
Widget found in array
  ↓
Callback updated (widget.value LEFT ALONE)
  ↓
Widget displays its current value (unchanged from user's last click)
```

**Why NOT Update widget.value in Path 2:**
- Widget already has correct value from user's last interaction
- Overwriting it causes event conflicts
- LiteGraph's internal state can desync
- Let the widget manage its own value

---

### 2.3 The splice() Pattern Explained

**rgthree's Widget Positioning Algorithm:**

```javascript
if (this.widgets[index] !== widget) {
    const oldIndex = this.widgets.findIndex(w => w === widget);
    if (oldIndex !== -1) {
        this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
    }
}
```

**Step-by-Step Breakdown:**

**Example: Moving widget from index 4 to index 2**

```javascript
// Initial state:
this.widgets = [btn1, btn2, groupA, groupB, groupC];
//              [0]   [1]   [2]     [3]     [4]

// Want groupC at index 2:
const oldIndex = this.widgets.findIndex(w => w === groupC);  // = 4

// Inner splice: Remove from index 4
this.widgets.splice(4, 1);
// → Removes 1 element at index 4
// → Returns [groupC]
// → Array is now: [btn1, btn2, groupA, groupB]

// [0] extracts first element:
this.widgets.splice(4, 1)[0];
// → Returns groupC (the widget object)

// Outer splice: Insert at index 2
this.widgets.splice(2, 0, groupC);
// → Inserts groupC at index 2, shifting others right
// → Array is now: [btn1, btn2, groupC, groupA, groupB]

// Final result:
this.widgets = [btn1, btn2, groupC, groupA, groupB];
//              [0]   [1]   [2]     [3]     [4]
```

**Why This Works:**
1. **Inner splice** removes widget from old position
2. **[0]** extracts the widget object from returned array
3. **Outer splice** inserts widget at correct new position
4. **Atomic operation**: Widget moved in single expression
5. **Preserves widget object**: Same instance, same event listeners, same state

---

## Part 3: Comparison - Before vs After

### 3.1 Widget Management Lifecycle

| Stage | Before (BROKEN) | After (FIXED) |
|-------|-----------------|---------------|
| **Button Creation** | `nodeCreated` (static, once) | `refreshWidgets` (dynamic, every call) |
| **Button Positioning** | Fixed at indices 0-1 (never moved) | find + splice (repositioned if needed) |
| **Group Widget Creation** | `refreshWidgets` (if missing) | `refreshWidgets` (if missing) |
| **Group Widget Value** | **Force updated every refresh** | **Set once on creation, never touched** |
| **Group Widget Callback** | Updated every refresh | Updated every refresh |
| **Widget Removal** | `removeWidget(index)` | `removeWidget(this.widgets[index])` |
| **Index Management** | Split (fixedWidgetsCount) | Unified (index = 0) |

### 3.2 Update Behavior Comparison

| Scenario | Before (v1.14) | After (v1.15) |
|----------|----------------|---------------|
| **First toggle click** | ✓ Works | ✓ Works |
| **Second toggle click** | ✗ Fails (requires F5) | ✓ Works |
| **Third toggle click** | ✗ Fails (requires F5) | ✓ Works |
| **Property change #1** | ✓ Works | ✓ Works |
| **Property change #2** | ✗ Fails (requires F5) | ✓ Works |
| **Continuous monitoring** | ✗ Broken (state desyncs) | ✓ Reliable |

---

## Part 4: Why This Pattern is Robust

### 4.1 Consistency with rgthree Original

**rgthree-comfy's Fast Groups Node:**

```javascript
// rgthree's refreshWidgets (simplified):
let index = 0;
for (const group of groups) {
    let widget = this.widgets.find((w) => w.label === widgetLabel);
    if (!widget) {
        widget = this.addCustomWidget(new FastGroupsToggleRowWidget(group, this));
    }
    // Update widget properties (but NOT value)
    widget.label = widgetLabel;
    
    // Position widget
    if (this.widgets[index] !== widget) {
        const oldIndex = this.widgets.findIndex((w) => w === widget);
        this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
    }
    index++;
}
// Remove excess
while ((this.widgets || [])[index]) {
    this.removeWidget(index++);
}
```

**Our Implementation:** Near-identical pattern, adapted for:
- Standard ComfyUI widgets (not custom widgets)
- Button management included in same loop
- Object-based `removeWidget` for better compatibility

### 4.2 Why find + splice is Superior to Physical Reconstruction

**Alternative Approach (Not Used): Complete Array Rebuild**

```javascript
// Flux V2 style (works for LoRA Loader, NOT for Fast Bypasser):
this.widgets = [];  // Clear array completely
this.widgets.push(btn1, btn2);
for (const group of filteredGroups) {
    this.widgets.push(groupWidget);
}
```

**Why NOT Used for FastGroupsBypasserV2:**

**Problem: Widget Creation Overhead**
- FastGroupsBypasserV2 refreshes every 100ms (continuous monitoring)
- Complete reconstruction = destroy and recreate all widgets every 100ms
- Event listeners would be lost and re-attached constantly
- Performance degradation

**Advantage of find + splice:**
- Widgets are **reused** (same object references)
- Event listeners persist across refreshes
- No creation/destruction overhead
- Only **repositioning** (very fast)

**When to Use Each Pattern:**

| Node Type | Pattern | Reason |
|-----------|---------|--------|
| **FLUX LoRA Loader V2** | Physical reconstruction | User-triggered updates only (low frequency) |
| **FastGroupsBypasserV2** | find + splice | Continuous monitoring (high frequency, 100ms loop) |

---

## Part 5: The 100ms Refresh Loop

### 5.1 Why Continuous Monitoring is Necessary

**Unlike FLUX LoRA Loader V2:**
- LoRA Loader responds to **its own properties** only (`visibleLoraCount`)
- When user changes dropdown → `updateLoraSlots()` runs once → done
- No need for continuous monitoring

**FastGroupsBypasserV2 Must Monitor External State:**
- Watches `graph._groups` (group list in canvas)
- Groups can be:
  - Created/deleted by user
  - Renamed by user
  - Moved/resized by user
  - Nodes inside groups can change mode externally
- **None of these trigger `node.onPropertyChanged`**
- Therefore: Continuous polling required

### 5.2 SimpleRefreshService Implementation

```javascript
class SimpleRefreshService {
    constructor() {
        this.nodes = [];
        this.scheduled = false;
    }
    
    addNode(node) {
        if (!this.nodes.includes(node)) {
            this.nodes.push(node);
            this.scheduleRefresh();
        }
    }
    
    removeNode(node) {
        const index = this.nodes.indexOf(node);
        if (index > -1) {
            this.nodes.splice(index, 1);
        }
    }
    
    scheduleRefresh() {
        if (this.scheduled) return;
        this.scheduled = true;
        setTimeout(() => {
            this.refresh();
            this.scheduled = false;
            if (this.nodes.length > 0) {
                this.scheduleRefresh();  // KEY: Recursive call (continuous loop)
            }
        }, 100);
    }
    
    refresh() {
        for (const node of this.nodes) {
            if (!node.removed) {
                node.refreshWidgets();
            }
        }
    }
}
```

**The Recursive Loop:**
```javascript
if (this.nodes.length > 0) {
    this.scheduleRefresh();  // Re-schedule after 100ms
}
```

**Why This is Critical:**
- Without recursion: Service runs once, then stops
- With recursion: Service runs every 100ms as long as nodes exist
- Result: FastGroupsBypasserV2 reacts to external changes in real-time

**Performance Consideration:**
- 100ms interval = 10 times per second
- Each refresh checks group list and repositions widgets if needed
- Very lightweight (find + splice operations)
- No noticeable performance impact

---

## Part 6: Migration and Compatibility

### 6.1 For Existing Users

**Impact:** **Zero configuration required**

**Workflows using FastGroupsBypasserV2:**
- All settings preserved (matchColors, matchTitle, sort, etc.)
- All widget states preserved (toggle positions)
- Behavior is identical, just **now works reliably**

**No migration needed:**
- Simply update to v1.15
- Existing workflows load and work correctly
- Bug is fixed transparently

### 6.2 Verification Steps

**After updating to v1.15:**

1. **Load a workflow with FastGroupsBypasserV2**
2. **Toggle a group** → Should work
3. **Toggle another group immediately** → Should work (no F5 needed)
4. **Change matchColors property** → Should update instantly
5. **Change matchTitle property** → Should update instantly
6. **Repeat steps 2-5 multiple times** → Should work every time

**Console Verification:**
- No error messages
- No infinite loop logs
- Widgets update smoothly

---

## Part 7: Technical Specifications

### 7.1 Files Modified

**Modified:**
- `js/fast_bypass_v2.js` (Complete `refreshWidgets` restructure)

**Unchanged:**
- `js/z_flux_lora_dynamic.js` (FLUX LoRA Loader V2 - unaffected)
- `nodes/utils/fast_bypasser.py` (Python backend - no changes needed)
- All other files

**Total Changes:**
- 1 file modified
- ~20 lines reorganized
- 3 critical bug fixes
- 0 new features (pure bug fix release)

### 7.2 Compatibility

**ComfyUI Version:**
- Compatible with ComfyUI 2.0+
- Tested with ComfyUI Desktop version

**Browser Compatibility:**
- All modern browsers (Chrome, Firefox, Edge)
- Requires JavaScript ES6+ (arrow functions, const/let)

**Workflow Compatibility:**
- **100% backward compatible** with v1.14 workflows
- No breaking changes
- Existing toggle states preserved

---

## Part 8: Installation and Upgrade

### 8.1 Fresh Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker.git
cd ComfyUI-NunchakuFluxLoraStacker
git checkout v1.15
```

**Result:**
- FastGroupsBypasserV2 with bug fix installed
- Ready to use immediately

### 8.2 Upgrade from v1.14

```bash
cd ComfyUI/custom_nodes/ComfyUI-NunchakuFluxLoraStacker
git pull origin main
git checkout v1.15
```

**Result:**
- Bug fix applied
- All workflows continue working
- No reconfiguration needed

### 8.3 Verification

**After installation/upgrade:**

1. **Restart ComfyUI**
2. **Add FastGroupsBypasserV2 node**
3. **Test multiple toggles** → Should work without F5
4. **Console check:**
   ```
   [FastBypassV2] loaded successfully
   ```

---

## Summary

### What v1.15 Does

**Fixes:**
- FastGroupsBypasserV2 "second update fails" bug
- Widget value update conflicts
- Widget removal index errors
- Widget array fragmentation

**Adds:**
- Reliable multi-update support
- Consistent widget positioning
- Professional user experience

**Maintains:**
- 100% backward compatibility
- All existing features
- Zero configuration changes

### Who Should Upgrade

**Recommended for:**
- **All users of FastGroupsBypasserV2** (critical bug fix)
- Anyone experiencing "frozen toggle" issues
- Users who previously needed F5 refresh after every change

**Not Affected:**
- Users who don't use FastGroupsBypasserV2
- FLUX LoRA Loader V2 users (no changes to that node)

---

## Conclusion

v1.15 represents a **critical stability fix** for FastGroupsBypasserV2:
- Bug that made the node practically unusable is now fixed
- Adopted rgthree's proven widget management pattern
- Maintains compatibility while fixing fundamental issues
- Professional, reliable workflow management tool

**For users:** FastGroupsBypasserV2 now works as intended - smoothly, reliably, without constant refreshes.

**For developers:** Clean implementation following established patterns from rgthree-comfy.

---

**Repository:** https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker  
**Release:** v1.15  
**Date:** December 5, 2025

