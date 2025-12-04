**LoRA Loader Fix - Complete Version**

**1. Root Cause of the Error**

Error that was occurring:

```
ValueError: Model structure not recognized. Expected ComfyFluxWrapper, got <class 'nunchaku.models.transformers.transformer_flux.NunchakuFluxTransformer2dModel'> (wrapped in OptimizedModule)
```

Three root causes:

1. **Model Type Not Supported:** LoRA loader only supported ComfyFluxWrapper → Not compatible with Nunchaku's NunchakuFluxTransformer2dModel
2. **torch.compile Wrapping:** When torch.compile is enabled, the model gets wrapped in OptimizedModule, but this was not being handled
3. **Circular Reference:** Creating a new model object (ModelPatcher) each time causes infinite nesting and memory leak

---

**2. Files to Modify**

D:\USERFILES\ComfyUI\ComfyUI\custom_nodes\ComfyUI-NunchakuFluxLoraStacker\nodes\lora\flux.py

Lines to replace: 213-270 (entire forward() method)

---

**3. Before and After Code Comparison**

Before (Problematic Implementation):

```python
# Old implementation: Only hardcoded ComfyFluxWrapper
if not isinstance(actual_model_wrapper, ComfyFluxWrapper):
    raise ValueError(f"Model structure not recognized...")

# Creates new model each time → Causes circular reference
ret_model = ModelPatcher(model)
ret_model_wrapper = ret_model.model
ret_model_wrapper.loras = [(lora_path, strength) for ...]
return (ret_model,)
```

Problems:

- Only checks for ComfyFluxWrapper
- Does not handle OptimizedModule wrapping
- Creates ModelPatcher new object → Circular reference

---

**4. Fixed Code (Complete Version)**

```python
def forward(self, model, loras):
    """
    Apply LoRA to model and return it
    
    Parameters
    ----------
    model : Union[ComfyFluxWrapper, NunchakuFluxTransformer2dModel]
        Model to apply LoRA to (may be wrapped in OptimizedModule)
    loras : List[Tuple[str, float]]
        List of LoRAs to apply [(lora_name, strength), ...]
    
    Returns
    -------
    Tuple[model]
        Model with LoRA applied
    """
    
    # Step 1: Extract actual model from OptimizedModule
    actual_model_wrapper = model
    
    # If wrapped by torch.compile in OptimizedModule, extract inner model
    if hasattr(model, '_orig_mod'):
        actual_model_wrapper = model._orig_mod
    
    # Step 2: Determine model type
    wrapper_class_name = type(actual_model_wrapper).__name__
    print(f"DEBUG: Detected model type: {wrapper_class_name}")
    
    # Step 3: Format LoRA list (deduplicate, filter empty)
    loras_to_apply = []
    seen = set()
    for lora_name, lora_strength in loras:
        if lora_name and lora_name not in seen:
            loras_to_apply.append((lora_name, lora_strength))
            seen.add(lora_name)
    
    print(f"DEBUG: Applying {len(loras_to_apply)} LoRAs")
    
    # Step 4: Handle ComfyFluxWrapper case
    if wrapper_class_name == 'ComfyFluxWrapper':
        print("DEBUG: Using ComfyFluxWrapper LoRA application method")
        
        ret_model_wrapper = actual_model_wrapper
        ret_model = model  # Return original model without creating new object
        
        # Directly modify ComfyFluxWrapper's loras list
        ret_model_wrapper.loras = []
        
        for lora_name, lora_strength in loras_to_apply:
            lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)
            ret_model_wrapper.loras.append((lora_path, lora_strength))
            print(f"DEBUG: Added LoRA {lora_name} with strength {lora_strength}")
    
    # Step 5: Handle NunchakuFluxTransformer2dModel case
    elif wrapper_class_name == 'NunchakuFluxTransformer2dModel':
        print("DEBUG: Using NunchakuFluxTransformer2dModel LoRA application method")
        
        ret_model_wrapper = actual_model_wrapper
        ret_model = model  # Return original model (CRITICAL: no new object creation)
        
        # Use Nunchaku's LoRA application methods
        if loras_to_apply:
            from nunchaku.lora.flux.compose import compose_lora as nunchaku_compose_lora
            
            # Create list of (lora_path, strength) tuples
            lora_tuples = []
            for lora_name, lora_strength in loras_to_apply:
                lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)
                lora_tuples.append((lora_path, lora_strength))
                print(f"DEBUG: Preparing LoRA {lora_name} at {lora_path}")
            
            # Handle single vs multiple LoRAs differently
            if len(lora_tuples) == 1:
                # Single LoRA: Apply directly
                lora_path, lora_strength = lora_tuples[0]
                ret_model_wrapper.update_lora_params(lora_path)
                ret_model_wrapper.set_lora_strength(lora_strength)
                print(f"DEBUG: Applied single LoRA with strength {lora_strength}")
            else:
                # Multiple LoRAs: Compose first, then apply
                composed_lora = nunchaku_compose_lora(lora_tuples)
                ret_model_wrapper.update_lora_params(composed_lora)
                print(f"DEBUG: Applied {len(lora_tuples)} composed LoRAs")
        else:
            # No LoRAs: Clear LoRA params
            ret_model_wrapper.update_lora_params(None)
            print("DEBUG: Cleared LoRA params")
    
    # Step 6: Handle unknown model types
    else:
        raise ValueError(
            f"Model structure not recognized. Expected ComfyFluxWrapper or NunchakuFluxTransformer2dModel, "
            f"got {type(actual_model_wrapper)}"
        )
    
    # Step 7: Validate returned model
    ret_wrapper_class_name = type(ret_model_wrapper).__name__
    if ret_wrapper_class_name not in ('ComfyFluxWrapper', 'NunchakuFluxTransformer2dModel'):
        raise ValueError(
            f"Returned model structure not recognized. Expected ComfyFluxWrapper or NunchakuFluxTransformer2dModel, "
            f"got {type(ret_model_wrapper)}"
        )
    
    print(f"DEBUG: Successfully applied LoRA using {ret_wrapper_class_name}")
    return (ret_model,)
```

---

**5. Detailed Explanation of Fixed Code**

**Step 1: Extract actual model from OptimizedModule**

When torch.compile wraps a model in OptimizedModule, the inner model is in _orig_mod attribute. Extract this to get the actual model. Reason: OptimizedModule itself doesn't have LoRA methods; we need to operate on the inner model.

**Step 2: Determine model type**

Use __name__ for type checking instead of isinstance(). Reason: Avoids import cycles and type checking issues.

**Step 3: Format LoRA list**

Remove duplicate LoRA names and filter out empty LoRA names to prevent applying same LoRA twice.

**Steps 4-5: Handle ComfyFluxWrapper and NunchakuFluxTransformer2dModel**

For ComfyFluxWrapper: Directly append (path, strength) tuples to loras list. CRITICAL: ret_model = model returns original model (NO new object creation).

For NunchakuFluxTransformer2dModel: Use Nunchaku's update_lora_params() and set_lora_strength() methods. Multiple LoRAs: Pre-compose with compose_lora() before applying. CRITICAL: ret_model = model returns original model.

**Step 6: Handle unknown model types**

Raise ValueError if model type is neither ComfyFluxWrapper nor NunchakuFluxTransformer2dModel.

**Step 7: Validate and return**

Verify returned model is correct type, then return original model object as-is (KEY to avoiding circular reference).

---

**6. Why Circular Reference is Avoided**

Problematic Code (causes circular reference):

ret_model = ModelPatcher(model) creates new object. Next LoRA node call: ret_model_2 = ModelPatcher(ret_model) wraps ret_model again. Result: ModelPatcher → ModelPatcher → ModelPatcher → INFINITE NESTING.

Fixed Code (no circular reference):

ret_model = model returns original object as-is. Next LoRA node call: actual_model_wrapper = model._orig_mod extracts from OptimizedModule. Modify model's LoRA directly, no new object creation. Return (model) returns same model (NO NESTING).

Result: No object nesting, memory usage stays constant, multiple LoRA applications don't crash.

---

**7. torch.compile Compatibility**

Flow when torch.compile is enabled:

1. torch.compile(model) wraps model in OptimizedModule
2. Extract actual model via _orig_mod
3. Apply LoRA to extracted model
4. Return original OptimizedModule-wrapped model
5. During inference: torch.compile optimizations remain active while LoRA is applied

---

**8. How to Apply the Fix**

Replace lines 213-270 in flux.py with the complete fixed code above.

---

**9. Summary**

- Added support for NunchakuFluxTransformer2dModel without creating new model wrappers
- Ensured compatibility with torch.compile OptimizedModule wrapping
- Removed circular reference by returning the original model instance
- Applied LoRA handling improvements for both ComfyFluxWrapper and NunchakuFluxTransformer2dModel
- Added validation to catch unsupported model structures earlier

