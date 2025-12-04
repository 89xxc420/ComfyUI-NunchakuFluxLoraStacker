**Release Date:** December 4, 2025

**Major Changes:**
- Removed all backup JavaScript files from repository
- Clean source code distribution without development artifacts
- Updated version to 1.13

---

## 1. Purpose of This Release

### Problem: Backup Files in Source Downloads

**Issue:**
Previous releases (v1.12 and earlier) included backup JavaScript files in the `js/` directory:
- `z_flux_lora_dynamic_backup_final_ok.js`
- `z_flux_lora_dynamic_backup_latest.js`
- `z_flux_lora_dynamic_backup_slots_ok.js`
- `z_flux_lora_dynamic_backup_combo_working.js`
- `z_flux_lora_dynamic_FINAL_WORKING_COMBO.js`

**Impact:**
- ComfyUI loads **all** JavaScript files from `custom_nodes/*/js/` directories
- Multiple versions of the same extension would load simultaneously
- This caused conflicts, unexpected behavior, and confusion
- Users downloading source code would get these backup files

### Solution: Complete Removal

**v1.13 Changes:**
1. Removed all backup files from `js/` directory
2. Moved backups to `backups/` directory (not tracked by git)
3. Updated git tracking to exclude backup files
4. Ensured clean source code in releases

---

## 2. Files Removed from Git Tracking

The following files were removed from the repository:

```
js/z_flux_lora_dynamic_FINAL_WORKING_COMBO.js        (116 lines)
js/z_flux_lora_dynamic_backup_combo_working.js       (115 lines)
js/z_flux_lora_dynamic_backup_final_ok.js            (116 lines)
js/z_flux_lora_dynamic_backup_latest.js              (116 lines)
js/z_flux_lora_dynamic_backup_slots_ok.js            (123 lines)
```

**Total:** 586 lines of redundant code removed

---

## 3. Current File Structure

### JavaScript Files (`js/` directory)

**Production Files (3 files):**
1. `z_flux_lora_dynamic.js` - FLUX LoRA Loader V2 dynamic UI controller
2. `fast_bypass_v2.js` - Fast Groups Bypasser V2 (ported from rgthree-comfy)
3. `widgethider.js` - FLUX LoRA Loader V1 widget visibility controller

**Backup Files (moved to `backups/` directory):**
- All backup files are now stored in `backups/` and excluded from git tracking
- This directory is local-only and will not appear in releases

---

## 4. Version Number Format Change

**v1.12:** `version = "1.12.0"` (semantic versioning)
**v1.13:** `version = "1.13"` (simplified format)

**Reason:**
- This is a maintenance/cleanup release, not a feature release
- Simplified version format is sufficient for custom nodes
- Easier to reference and communicate

---

## 5. Verification

### How to Verify Clean Installation

After installing v1.13, check your `js/` directory:

```bash
ls custom_nodes/ComfyUI-NunchakuFluxLoraStacker/js/
```

**Expected output (3 files only):**
```
fast_bypass_v2.js
widgethider.js
z_flux_lora_dynamic.js
```

**If you see backup files:**
- You may have installed from an older release
- Or manually copied files from elsewhere
- Solution: Delete the custom node directory and reinstall v1.13

### ComfyUI Console Output

On startup, you should see exactly **3** log messages from this extension:

```
★★★ z_flux_lora_dynamic.js: RESTORE COMBO BOX + PHYSICAL DELETE (FINAL) ★★★
ComfyUI-NunchakuFluxLoraStacker: JavaScript file loaded!
(Fast Groups Bypasser V2 initializes silently)
```

**If you see duplicate messages:**
- Multiple JavaScript files are being loaded
- Check for backup files in `js/` directory
- Clean install recommended

---

## 6. No Functional Changes

**Important:** v1.13 has **zero functional changes** from v1.12.

This is a **maintenance release** focused solely on:
- Repository cleanup
- Source code hygiene
- Distribution quality

**All features from v1.12 work identically:**
- FLUX LoRA Loader V2 with dynamic combo box UI
- Fast Groups Bypasser V2
- FLUX LoRA Loader V1 (backward compatibility)

**If you are using v1.12 without issues, upgrading to v1.13 is optional.**

**However, if you experience:**
- Duplicate nodes in the node menu
- Console errors about conflicting extensions
- Unexpected behavior with FLUX LoRA Loader

**Then upgrading to v1.13 is recommended.**

---

## 7. Migration from v1.12 to v1.13

### For New Installations
Simply install v1.13. No migration needed.

### For Existing Users (Clean Reinstall Recommended)

**Option A: Clean Reinstall (Recommended)**
```bash
cd ComfyUI/custom_nodes
rm -rf ComfyUI-NunchakuFluxLoraStacker
git clone https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker.git
cd ComfyUI-NunchakuFluxLoraStacker
git checkout v1.13
```

**Option B: Update Existing Installation**
```bash
cd ComfyUI/custom_nodes/ComfyUI-NunchakuFluxLoraStacker
git fetch origin
git checkout v1.13

# Manually remove backup files if they exist
rm -f js/z_flux_lora_dynamic_backup_*.js
rm -f js/z_flux_lora_dynamic_FINAL_WORKING_COMBO.js
```

**Option C: ComfyUI Manager**
1. Open ComfyUI Manager
2. Go to "Custom Nodes Manager"
3. Find "ComfyUI-NunchakuFluxLoraStacker"
4. Click "Update" or "Reinstall"

### Verify Installation
1. Restart ComfyUI
2. Check console logs (should see 3 messages only)
3. Test FLUX LoRA Loader V2 node
4. Verify no duplicate nodes appear

---

## 8. Technical Details

### Git Operations Performed

```bash
# Remove backup files from git tracking
git rm js/z_flux_lora_dynamic_backup_*.js
git rm js/z_flux_lora_dynamic_FINAL_WORKING_COMBO.js

# Commit changes
git commit -m "Remove backup JS files from js/ directory"
git push origin main

# Update v1.12 tag to point to cleaned commit
git tag -d v1.12
git tag v1.12
git push origin --delete tag v1.12
git push origin v1.12

# Create v1.13 release
git tag v1.13
git push origin v1.13
```

### Why v1.12 Was Also Updated

**v1.12 tag was moved** to the commit where backups were removed.

**Reason:**
- Users who already downloaded v1.12 may have backup files
- Moving the tag ensures new v1.12 downloads are clean
- However, users should prefer v1.13 for clarity

**Recommendation:**
- Use v1.13 for new installations
- v1.12 is updated but v1.13 is the canonical "clean" release

---

## 9. Future Releases

### Backup File Management Policy

Going forward, all backup files will:
1. Be stored in `backups/` directory
2. Be excluded from git tracking (`.gitignore`)
3. Never appear in releases
4. Be local development artifacts only

### Version Numbering

- **Major.Minor format** (e.g., 1.13, 1.14)
- Semantic versioning (1.x.y) reserved for significant releases if needed

---

## 10. Credits and Acknowledgments

### Development
- **Author:** ussoewwin
- **Repository:** https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker

### Special Thanks
- **rgthree-comfy** for Fast Groups Bypasser original implementation
- **efficiency-nodes-comfyui** for widget visibility management patterns
- **Nunchaku** team for FLUX model optimization

---

## Summary

v1.13 is a **maintenance release** that ensures:
- ✅ Clean source code distribution
- ✅ No backup files in downloads
- ✅ No conflicts from duplicate JavaScript files
- ✅ Professional repository hygiene

**Functionally identical to v1.12** but with cleaner file structure.

**Recommended for all users** to avoid potential conflicts.

---

For questions or issues, please open a GitHub issue:
https://github.com/ussoewwin/ComfyUI-NunchakuFluxLoraStacker/issues

